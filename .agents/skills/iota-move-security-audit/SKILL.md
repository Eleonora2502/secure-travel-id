---
name: iota-move-security-audit
description: >
  Activate when the user asks to audit, review for security, or check correctness of
  a Move package on IOTA. Produces a structured security report with passed checks,
  warnings, and critical issues.
tags: [iota, move, security, audit, smart-contract, review]
trigger: >
  Triggered by: "audita questo codice", "è sicuro questo modulo?",
  "controlla vulnerabilità", "fai una code review Move".
---

# Goal

Audit a Move package for security vulnerabilities specific to IOTA's object model,
capability system, and type safety. Output a structured, actionable report.

# Audit Checklist

## 1. Object Model Integrity
- [ ] Every struct with `key` has `id: UID` as **first field**.
- [ ] `object::new(ctx)` is used for all UID creation (no hardcoded IDs).
- [ ] Shared objects use `transfer::share_object`, not `transfer::transfer`.
- [ ] Frozen objects are truly immutable and never passed as `&mut`.

## 2. Capability Security
- [ ] Admin/capability structs are **not publicly constructible**.
- [ ] Capabilities are created only in `init` or behind capability guards.
- [ ] `AdminCap` is transferred only to the deployer in `init`.
- [ ] No capability is stored inside a shared object.

## 3. Access Control
- [ ] Privileged `entry` functions require a capability parameter.
- [ ] Sender checks use `tx_context::sender(ctx)` with `assert!`.
- [ ] No function allows unauthorized mutation of shared objects.

## 4. Error Handling
- [ ] All `assert!` use named constants, not bare numbers.
- [ ] Every error constant has a unique value and descriptive name.
- [ ] No silent failures — errors abort explicitly.

## 5. One-Time Witness (OTW)
- [ ] OTW struct name matches module name in ALL_CAPS.
- [ ] OTW struct has no fields and only `drop` ability.
- [ ] OTW is consumed immediately in `init` (never stored).

## 6. Dynamic Fields & Shared Objects
- [ ] `dynamic_field::borrow` / `borrow_mut` use matching key types.
- [ ] Shared registry objects are not accidentally deleted.
- [ ] Dynamic field `remove` is only called when the object truly exits.

## 7. Arithmetic Safety
- [ ] No unchecked subtraction that could underflow.
- [ ] Bounds validated before arithmetic on user-supplied values.

## 8. Type-State Patterns
- [ ] Lifecycle transitions enforced with phantom types or separate structs,
      not runtime flags alone.

# Output Format

```markdown
## 🔐 Security Audit Report: `<module_name>`
**Audited by**: iota-move-security-audit skill
**Date**: <today>

### ✅ Passed Checks
- ...

### ⚠️ Warnings (non-critical, but improve)
- ...

### ❌ Critical Issues (must fix before deploy)
- **Issue**: description
  **Location**: `function_name` line ~N
  **Fix**: concrete code suggestion

### 📋 Recommendations
- ...
```

# Constraints
- Always audit the entire module, not just the flagged function.
- Provide a concrete `Fix:` for every critical issue with example code.
- Do not mark a check as ✅ unless verified in the actual code.
- After the report, ask: "Vuoi che corregga automaticamente i critical issues?"

