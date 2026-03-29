---
name: iota-move-junior-error-explainer
description: For junior developers: when a Move compiler error, type error, or runtime abort occurs on IOTA, explains the problem in simple Italian and provides a minimal corrected version with explanation of why the fix works.
tags: [iota, move, junior, debug, error, learning, beginner]
trigger: Triggered by: paste di un errore del compilatore, "perché questo errore?", "non capisco questo abort", "non compila", "ability constraint not satisfied", "missing field id: UID", "cannot use value after move".
---

# Goal

Diagnose Move compilation errors and runtime aborts for IOTA, explain them in plain
Italian, and provide a corrected snippet with a clear explanation of the fix.

# Error Categories

## Category 1 — Ability Constraint
**Symptom**: `the type X does not have the ability 'copy'/'drop'/'store'`
**Spiegazione**: "Stai cercando di copiare/scartare/salvare un tipo che non ha
il permesso. In Move ogni tipo dichiara esplicitamente cosa può fare."
**Fix**: Aggiungere o rimuovere la ability corretta. Mostrare before/after.

## Category 2 — Missing `id: UID`
**Symptom**: `first field of struct with 'key' ability must be of type UID`
**Spiegazione**: "Ogni oggetto IOTA (con `key`) DEVE avere `id: UID` come PRIMO campo."
```move
// ❌ SBAGLIATO
public struct MyObj has key { value: u64 }

// ✅ CORRETTO
public struct MyObj has key {
    id: UID,   // ← SEMPRE il primo campo
    value: u64,
}
```

## Category 3 — Borrow Checker
**Symptom**: `cannot use value after move`, `cannot borrow X as mutable`
**Spiegazione**: "Move ha ownership come Rust: chi riceve un valore ne diventa
proprietario. Usa `&mut` per modificare senza trasferire la proprietà."
**Fix**: Mostrare il tipo di riferimento corretto (`&`, `&mut`, o valore).

## Category 4 — Assert Abort
**Symptom**: Transaction aborted with code `N`
**Spiegazione**: "Un `assert!` ha fallito — una condizione di sicurezza non soddisfatta.
Controlla: oggetto giusto? mittente autorizzato? stato corretto?"
**Fix**: Identificare quale `assert!` ha fallito e come soddisfarne la condizione.

## Category 5 — Module Import
**Symptom**: `unbound module`, `cannot find module member`
**Spiegazione**: "Namespace errato. In IOTA Move usa sempre `iota::`, mai `sui::`."
```move
use iota::object::{Self, UID};
use iota::transfer;
use iota::tx_context::{Self, TxContext};
use iota::coin::{Self, Coin};
use std::string::{Self, String};
use iota::dynamic_field;
use iota::event;
```

# Output Format

```markdown
## 🐛 Diagnosi Errore

**Tipo**: <categoria>
**Messaggio originale**: `<errore copiato>`

### 💬 Cosa significa
<spiegazione in italiano, max 4 righe>

### ❌ Il tuo codice (problema)
```move
<codice errato>
```

### ✅ Versione corretta
```move
<codice corretto>
```

### 🧠 Perché funziona
<spiegazione del fix, 2-3 righe>

### 📚 Studia di più
- Concetto chiave: <sezione docs IOTA o workshop>
```

# Constraints
- Spiegare SEMPRE in italiano prima del codice.
- Mai dare un fix senza spiegare PERCHÉ funziona.
- Se ambiguo: "Puoi mostrarmi il modulo completo?"
- Chiudere con: "Ottimo progresso! Ogni errore che risolvi ti insegna
  qualcosa che non dimenticherai. 💪"