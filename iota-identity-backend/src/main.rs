use axum::{routing::post, Json, Router};
use axum::http::{StatusCode, Method};
use tower_http::cors::{CorsLayer, Any};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::fs;
use std::net::SocketAddr;
use std::time::Duration;
use iota_identity::document::IotaDocument;
use iota_identity::credential::{Credential, CredentialBuilder, Subject, PresentationBuilder, Presentation, Jwt, JwsSignatureOptions, JwtPresentationOptions, FailFast};
use iota_identity::credential::{JwtPresentationValidatorUtils, JwtPresentationValidator, JwtPresentationValidationOptions, DecodedJwtPresentation, JwtCredentialValidator, JwtCredentialValidationOptions, DecodedJwtCredential, SubjectHolderRelationship};
use iota_identity::resolver::Resolver;
use iota_sdk::types::block::output::Timestamp;
use iota_identity::client::JwsVerificationOptions;
use iota_identity::crypto::EdDSAJwsVerifier;
use iota_sdk::types::block::address::IotaAddress;
use iota_identity::core::CoreDID;
use iota_identity::core::Object;
use std::collections::HashMap;


use identity_logic::{get_stronghold_storage, get_funded_client, create_did_document, get_read_only_client};

// Per serializzare e deserializzare gli "oggetti" in Java 
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageId { package_id: String }

#[derive(Serialize)]
struct DidResponse { did: String }

#[derive(Serialize)]
struct JwtResponse { jwt: String }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VcJwt { package_id: String, vc_jwt: String }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VpJwt { package_id: String, vp_jwt: String }

#[derive(Serialize)]
struct ValidationResponse { success: bool, output: String }

//funzione che controlla se esiste già un DID Document e una chiave, altrimenti li crea
async fn create_or_load_did(
    doc_file: &str,
    fragment_file: &str,
    stronghold_path: &str,
) -> Result<(IotaDocument, String), anyhow::Error> {
    let storage = get_stronghold_storage(Some(PathBuf::from(stronghold_path)))?;

    if !PathBuf::from(doc_file).exists() {
        let client = get_funded_client(&storage).await?;
        let (doc, frag) = create_did_document(&client, &storage).await?;
        fs::write(doc_file, doc.to_json()?)?;
        fs::write(fragment_file, &frag)?;
        Ok((doc, frag))
    } else {
        let doc_json = fs::read_to_string(doc_file)?;
        let doc = IotaDocument::from_json(&doc_json)?;
        let frag = fs::read_to_string(fragment_file)?.trim().to_string();
        Ok((doc, frag))
    }
}

//è l'endpoint che il viaggiatore chiama per creare il proprio DID Document, se non esiste già, e ottenere la DID da usare nei passaggi successivi
async fn holder_create_did(Json(_body): Json<PackageId>) -> Result<Json<DidResponse>, StatusCode> {
    let holder_doc_file = "./holder_doc.json";
    let holder_fragment_file = "./holder_fragment.txt";
    let stronghold_path = "./holder.stronghold";

    let (holder_doc, _) = create_or_load_did(holder_doc_file, holder_fragment_file, stronghold_path)
        .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(DidResponse { did: holder_doc.id().to_string() }))
}

async fn app_issue_vc(Json(_body): Json<PackageId>) -> Result<Json<JwtResponse>, StatusCode> {
    let issuer_doc_file = "./issuer_doc.json"; //file che contiene la DID Document dell'emittente
    let issuer_fragment_file = "./issuer_fragment.txt"; //file che contiene un promemoria della chiave che bisogna usare per firmare la VC
    let issuer_stronghold_path = "./issuer.stronghold"; //file che contiene la cassaforte dell'emittente

    let (issuer_doc, issuer_fragment) = create_or_load_did( //controlla se esiste già un DID Document e una chiave, altrimenti li crea
        issuer_doc_file,
        issuer_fragment_file,
        issuer_stronghold_path,
    ).await.map_err(|e| { //gestione delle eccezioni come Java con exceptions
        eprintln!("Errore creazione DID App: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
}

    //adesso andiamo a caricare il DID document che abbiamo creato precedentemente
    let holder_doc_json = std::fs::read_to_string("./holder_doc.json")
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let holder_doc = IotaDocument::from_json(&holder_doc_json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let subject = Subject::from_json_value(json!({
        "id": holder_doc.id().as_str(),
        "nome": "Mario",
        "cognome": "Rossi",
        "data_di_nascita": "15/05/1985",
        "luogo_di_nascita": "Roma",
        "cittadinanza": "Italiana",
        "sesso": "M",
        "documento": { 
            "tipo": "Passaporto", 
            "numero": "YA1234567" 
        }
    })).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let credential: Credential<Object> = CredentialBuilder::default()
        .id(Url::parse("https://securetravel.app/credentials/1").unwrap())
        .issuer(Url::parse(issuer_doc.id().as_str()).unwrap())
        .type_("TravelIdentityCredential") // Il tipo di documento
        .subject(subject)
        .build().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let issuer_storage = get_stronghold_storage(Some(PathBuf::from(issuer_stronghold_path)))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let credential_jwt = issuer_doc //impacchettiamo il documento 
        .create_credential_jwt(
            &credential,
            &issuer_storage,
            &issuer_fragment,
            &JwsSignatureOptions::default(),
            None,
        )
        .await
        .map_err(|e| {
            eprintln!("Errore firma VC: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(JwtResponse {
        jwt: credential_jwt.as_str().to_string(),
    }))


//Generazione del link o del Qr code da mostrare. Questa sarà la VP temporanea
async fn holder_create_vp(Json(body): Json<VcJwt>) -> Result<Json<JwtResponse>, StatusCode> {
    let stronghold_path = "./holder.stronghold";
    let holder_doc_file = "./holder_doc.json";
    let holder_fragment_file = "./holder_fragment.txt";

    let (holder_doc, holder_fragment) = create_or_load_did(holder_doc_file, holder_fragment_file, stronghold_path)
        .await.map_err(|_| StatusCode::NOT_FOUND)?;

    let holder_storage = get_stronghold_storage(Some(PathBuf::from(stronghold_path))).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let challenge = "challenge-123";
    let expires = Timestamp::now_utc().checked_add(Duration::from_secs(24 * 60 * 60)).unwrap();

    let presentation: Presentation<Jwt> = PresentationBuilder::new(
        holder_doc.id().to_url().into(), Default::default())
        .credential(Jwt::new(body.vc_jwt))
        .build().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let vp_jwt: Jwt = holder_doc.create_presentation_jwt(&presentation, &holder_storage, &holder_fragment, 
        &JwsSignatureOptions::default().nonce(challenge.to_owned()), 
        &JwtPresentationOptions::default().expiration_date(expires))
        .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(JwtResponse { jwt: vp_jwt.as_str().to_string() }))
}

// è la garanzia che l'host avrà per i dati 
async fn verifier_validate(Json(body): Json<VpJwt>) -> Result<Json<ValidationResponse>, StatusCode> {
    let vp_jwt = Jwt::new(body.vp_jwt);
    let challenge = "challenge-123"; 
    let mut output = String::new();

    let verifier_client = get_read_only_client().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut resolver: Resolver<IotaDocument> = Resolver::new();
    resolver.attach_iota_handler(verifier_client);

    let presentation_verifier_options = JwsVerificationOptions::default().nonce(challenge.to_owned());

    let holder_did: CoreDID = JwtPresentationValidatorUtils::extract_holder(&vp_jwt).map_err(|_| StatusCode::BAD_REQUEST)?;
    let holder_doc: IotaDocument = resolver.resolve(&holder_did).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let vp_validation_options = JwtPresentationValidationOptions::default().presentation_verifier_options(presentation_verifier_options);
    let decoded_vp: DecodedJwtPresentation<Jwt> = JwtPresentationValidator::with_signature_verifier(EdDSAJwsVerifier::default())
        .validate(&vp_jwt, &holder_doc, &vp_validation_options)
        .map_err(|_| { return StatusCode::BAD_REQUEST; })?;
    
    output.push_str("✅ Identità Verificata e Firma Valida!\n");

    let jwt_credentials: &Vec<Jwt> = &decoded_vp.presentation.verifiable_credentials;
    let issuers: Vec<CoreDID> = jwt_credentials.iter()
        .map(|jwt| iota_identity::credential::JwtCredentialValidatorUtils::extract_issuer_from_jwt(jwt))
        .collect::<Result<Vec<CoreDID>, _>>().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let issuers_documents: HashMap<CoreDID, IotaDocument> = resolver.resolve_multiple(&issuers).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let credential_validator = JwtCredentialValidator::with_signature_verifier(EdDSAJwsVerifier::default());
    let credential_validation_options = JwtCredentialValidationOptions::default()
        .subject_holder_relationship(holder_did.to_url().into(), SubjectHolderRelationship::AlwaysSubject);

    for (index, jwt_vc) in jwt_credentials.iter().enumerate() {
        let issuer_doc = &issuers_documents[&issuers[index]];
        let result: Result<DecodedJwtCredential<Object>, _> = credential_validator
            .validate(jwt_vc, issuer_doc, &credential_validation_options, FailFast::FirstError);

        match result {
            Ok(_) => { output.push_str("✅ Dati Documento Estratti in Sicurezza.\n"); },
            Err(_) => { return Ok(Json(ValidationResponse { success: false, output: "❌ Documento Manomesso o Invalido.".to_string() })); }
        }
    }

    output.push_str("🎉 Check-in Sicuro Completato!");
    Ok(Json(ValidationResponse { success: true, output }))
}


// 6. L'ACCENSIONE DEL SERVER (MAIN)
#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/holder/create-did", post(holder_create_did))
        .route("/api/issuer/issue-vc", post(app_issue_vc))
        .route("/api/holder/create-vp", post(holder_create_vp))
        .route("/api/verifier/validate", post(verifier_validate))
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("Il Motore Rust di SecureTravel ID è acceso su http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}