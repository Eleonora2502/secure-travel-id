//Creo una cassaforte virtuale che cripta e salva le chiavi private della persona esclusivamente in locale e non sul cloud 
use iota_sdk::client::secret::stronghold::StrongholdSecretManager;
use iota_sdk::client::Password;
use iota_identity::storage::StrongholdStorage;
use iota_identity::storage::Storage;
use std::path::PathBuf;
use iota_identity::client::IdentityClient;
use iota_identity::storage::StorageSigner;
use iota_identity::storage::JwkStorage;
use iota_identity::storage::KeyIdStorage;
use iota_identity::storage::KeyType;
use iota_identity::storage::JwsAlgorithm;
use iota_sdk::types::block::address::IotaAddress;
use iota_identity::document::IotaDocument;
use iota_identity::storage::identity_storage;
use iota_identity::storage::JwkMemStore;
use iota_identity::document::MethodScope;
use iota_identity::client::Signer;
use iota_identity::client::IotaKeySignature;
use iota_identity::client::OptionalSync;

//è un budget che viene usato per le transazioni sulla rete
const TEST_GAS_BUDGET: u64 = 100_000_000;

//Creiamo e apriamo la cassaforte virtuale
//questa funzione restuitirà storga in caso positivo e un errore in caso negatico 
pub fn get_stronghold_storage(
    path: Option<PathBuf>,
) -> Result<Storage<StrongholdStorage, StrongholdStorage>, anyhow::Error> {

    //diamo un percorso, se non lo diamo, ne ceglierà uno di default
    let path = path.unwrap_or_else(|| PathBuf::from("./default.stronghold"));

    //creiamo una password per la cassaforte
    let password = Password::from("secure_password".to_owned());

    //Adesso creiamo la cassaforte con il percorso e la password
    let stronghold = StrongholdSecretManager::builder()
        .password(password.clone())
        .build(path.clone())?; // il ? serve per gestire eventuali errori

        let stronghold_storage = StrongholdStorage::new(stronghold); //istanziazione della cassaforte, stessa cosa che facciamo in Java

        Ok(Storage::new(
        stronghold_storage.clone(), //storage per le chiavi private
        stronghold_storage.clone(), //storage per le identità, in questo caso usiamo la stessa cassaforte per entrambi
        ))
    }

    //Creiamo un client che utilizza la cassaforte per gestire le chiavi e le identità
pub async fn get_funded_client<K, I>(
    storage: &Storage<K, I>, // K e I sono i generics che utilizzavamo in java
) -> Result<IdentityClient<StorageSigner<K, I>>, anyhow::Error>
where
    K: JwkStorage, // K gestisce le chiavi in formato JWK
    I: KeyIdStorage, // I gestisce gli ID delle chiavi
{
    let generate = storage
        .key_storage()
        .generate(KeyType::new("Ed25519"), JwsAlgorithm::EdDSA)
        .await?;

    let public_key_jwk = generate
        .jwk //formato json web key, formato standard per le chiavi crittografiche
        .to_public() //crea una chiave pubblica a partire da quella privata, è importante perché la chiave pubblica è quella che viene condivisa con gli altri per identificare la persona, mentre la chiave privata rimane segreta e viene usata per firmare le transazioni e dimostrare la proprietà dell'identità
        .expect("public components should be derivable"); //se la chiave pubblica non può essere derivata, c'è un problema con la chiave privata
    
    let signer = StorageSigner::new(storage, generate.key_id, public_key_jwk); //crea un signer che utilizza la cassaforte per accedere alla chiave privata e firmare le transazioni
    let sender_address = IotaAddress::from(&Signer::public_key(&signer).await?); //crea un indirizzo a partire dalla chiave pubblica del signer, questo indirizzo sarà usato per ricevere i fondi e interagire con la rete

    // Richiede fondi per l'indirizzo del signer, questa è una funzione che simula la richiesta di fondi per testare le transazioni sulla rete
    request_funds(&sender_address).await?;

    let read_only_client = get_read_only_client().await?;
    let identity_client = IdentityClient::new(read_only_client, signer).await?;

    Ok(identity_client)
}

// Creiamo e pubblichiamo il DID (Passaporto digitale) sulla rete
pub async fn create_did_document<K, I, S>(
    identity_client: &IdentityClient<S>,
    storage: &Storage<K, I>,
) -> anyhow::Result<(IotaDocument, String)>
where
    K: identity_storage::JwkStorage, //chiavi in formato JWK
    I: identity_storage::KeyIdStorage, //nomi per le chiavi
    S: Signer<IotaKeySignature> + OptionalSync, //signer che può essere usato in modo sincrono o asincrono
{
    let mut unpublished: IotaDocument =
        IotaDocument::new(&identity_client.network_name().await?)?;
        
    let verification_method_fragment = unpublished //verifica all'interno del documento 
        .generate_method(
            storage,
            JwkMemStore::ED25519_KEY_TYPE,
            JwsAlgorithm::EdDSA,
            None,
            MethodScope::VerificationMethod,
        )
        .await?;

    let document = identity_client 
        .publish_did_document(unpublished) //da locale lo mandiamo sulla rete 
        .with_gas_budget(TEST_GAS_BUDGET)
        .build_and_execute(identity_client)
        .await?
        .output;

    Ok((document, verification_method_fragment)) //restituisce il documento pubblicato e il frammento del metodo di verifica
}

