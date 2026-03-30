---
name: iota-move-expert
description: Activate when the user asks to write, review, or architect Move smart contracts for IOTA. Applies IOTA-specific conventions: object-centric storage, UID/key ability, PTBs, module init, capabilities, type-state, OTW, and dynamic fields.
tags: [iota, move, smart-contract, blockchain, objects, PTB]
trigger: Triggered by: "scrivi un modulo Move", "crea uno smart contract IOTA", "come si fa X in Move IOTA", "rivedi questo codice Move".
---

# Goal

Generate and review production-quality Move code for IOTA, strictly following
IOTA's object model, ability system, and best-practice patterns from the official
IOTA workshops (Core I–IV).

# Instructions

## Object Model Rules

- Every struct intended as an on-chain object MUST have `key` ability and `id: UID`
  as its **first field**, always initialized with `object::new(ctx)`.
- Distinguish object ownership explicitly:
  - `transfer::transfer(obj, recipient)` → single-owner object
  - `transfer::share_object(obj)` → shared (mutable by all)
  - `transfer::freeze_object(obj)` → immutable (readable by all)
- Never use Diem-style global storage (`move_to`, `move_from`, `borrow_global`).

## Abilities Cheatsheet

| Ability | Meaning in IOTA Move |
|--------:|----------------------|
| `key`   | Object type; requires `id: UID` first field |
| `store` | Can be embedded inside other objects or stored dynamically |
| `copy`  | Value can be duplicated (use sparingly) |
| `drop`  | Value can be discarded without explicit destruction |

## Module Initializer

- Use `fun init(ctx: &mut TxContext)` for one-time setup (runs only at publish).
- Create singleton admin caps, shared registries, or OTW structs here.

## Entry Functions

- Mark user-callable functions with `entry` so wallets/PTBs can invoke them directly.
- Accept objects by value (to transfer/destroy), `&mut` (to mutate), or `&` (to read).

## Error Handling

- Define error constants: `const E_NOT_AUTHORIZED: u64 = 0;`
- Use `assert!(condition, E_NOT_AUTHORIZED);` — never use bare `abort 0`.

## Programmable Transaction Blocks (PTBs)

- PTBs chain multiple Move calls atomically; return values from call N can be
  passed as inputs to call N+1.
- Always specify all object inputs upfront (owned and shared).

## Strings

- Use `std::string::utf8(b"text")` or the `.to_string()` alias on byte literals.
- For user input that may be invalid UTF-8, use `try_to_string()` which returns `Option<String>`.

## One-Time Witness (OTW)

- OTW structs must:
  - match the module name in ALL_CAPS,
  - have no fields,
  - and only be created inside `init`.
- Required for coin/token type registration with `iota::coin::create_currency`.

# Code Template

~~~move
module myapp::my_module {
    use iota::object::{Self, UID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use std::string::{Self, String};

    // === Error constants ===
    const E_NOT_AUTHORIZED: u64 = 0;
    const E_INVALID_STATE:  u64 = 1;

    // === Structs ===
    public struct AdminCap has key, store { id: UID }

    public struct MyObject has key, store {
        id: UID,
        name: String,
        value: u64,
    }

    // === Module initializer ===
    fun init(ctx: &mut TxContext) {
        let cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(cap, tx_context::sender(ctx));
    }

    // === Entry functions ===
    public entry fun create(
        _cap: &AdminCap,
        name: vector<u8>,
        value: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let obj = MyObject {
            id: object::new(ctx),
            name: string::utf8(name),
            value,
        };
        transfer::transfer(obj, recipient);
    }

    public entry fun update_value(obj: &mut MyObject, new_value: u64) {
        obj.value = new_value;
    }
}
~~~

# Constraints

- NEVER mix Diem Move and IOTA Move syntax.
- Always import from `iota::` namespace, not `sui::` or `aptos::`.
- Validate sender identity with `tx_context::sender(ctx)` when ownership matters.
- Write at least one `#[test]` function per module in a `#[test_only]` module block.