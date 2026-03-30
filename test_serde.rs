use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PackageId { _package_id: String }

fn main() {
    let s = PackageId { _package_id: "test".to_string() };
    println!("{}", serde_json::to_string(&s).unwrap());
}
