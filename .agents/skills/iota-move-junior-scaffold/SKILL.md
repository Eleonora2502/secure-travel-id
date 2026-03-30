---
name: iota-move-junior-scaffold
description: For junior developers: generates complete, heavily annotated Move package scaffolding for IOTA, explaining every line of code in Italian. Ideal for learners following the IOTA Core Workshops (Core I–IV).
tags: [iota, move, junior, scaffold, learning, beginner]
trigger: Triggered by: "crea un progetto Move da zero", "non so da dove iniziare", "spiega mentre scrivi", "sono alle prime armi con Move".
---

# Goal

Generate a complete Move package skeleton for IOTA with inline Italian explanations
for every code construct. Help junior developers understand **why** each piece exists,
not just **what** it does.

# Instructions

## Step 1 — Ask the User
Before generating, ask:
1. "Come vuoi chiamare il package e il modulo principale?"
2. "Cosa fa il tuo dApp in una frase?"
3. "Hai già installato IOTA CLI? (sì/no)"

## Step 2 — Generate Move.toml
```toml
[package]
name = "<PackageName>"
edition = "2024.beta"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "framework/testnet" }

[addresses]
<package_name> = "0x0"
```
Spiega: "Move.toml è come il package.json di Node. `0x0` = indirizzo assegnato al deploy."

## Step 3 — Generate Module Skeleton

For every struct, add:
```
// 📦 STRUTTURA: <NomeStruct>
// Rappresenta <cosa è> sulla blockchain IOTA.
// - `key`: oggetto on-chain con ID univoco.
// - `id: UID`: OBBLIGATORIO — identificatore unico su IOTA.
// - `store`: può essere salvato dentro altri oggetti.
```

For every function, add:
```
// 🔧 FUNZIONE: <nome>
// Quando viene chiamata: <scenario>.
// `entry`: invocabile direttamente da wallet o PTB.
// `ctx: &mut TxContext`: contesto tx — crea oggetti e legge il mittente.
```

## Step 4 — Generate Tests
For each `entry` function, generate a `#[test]` using `test_scenario`.
Spiega: "`iota move test` esegue i test. `test_scenario` simula txn firmate da indirizzi diversi."

## Step 5 — Next Steps Section
Always output after the code:
```markdown
## 🚀 Prossimi Passi
1. `iota move build` — verifica la compilazione
2. `iota move test` — esegui i test
3. `iota client publish --gas-budget 100000000` — pubblica su devnet
4. Workshop Core II — Shared Objects e PTBs
5. Workshop Core III — Capabilities e Type-State
```

# Constraints
- OGNI riga non ovvia ha un commento inline in italiano.
- Nessuna conoscenza pregressa di Move assunta.
- Genera sempre `Move.toml` completo.
- Genera sempre almeno UN test per modulo.
- Spiega la differenza tra `transfer`, `share_object`, `freeze_object` in commenti.


