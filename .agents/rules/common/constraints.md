# Development Constraints

> This is a stub file. Docker & network constraints split to a topic file for on-demand loading.
>
> - [docker.md](docker.md) — Docker & network constraints (volume mounts, UDP port ranges, proxy pitfalls)

## Git Commit Rules

### Cargo.lock Must Be Committed
**ALWAYS** commit `Cargo.lock` along with dependency changes. This file tracks exact dependency versions and must be in sync with `Cargo.toml`.

Common mistake: Forgetting to `git add Cargo.lock` after `Cargo.toml` changes. This causes build failures for other developers.

**Checklist before committing:**
- [ ] `Cargo.toml` changes committed
- [ ] `Cargo.lock` changes committed (if dependencies changed)
- [ ] `git status` shows clean working tree

## Lockfile Discipline

ALWAYS commit the project's lockfile (`Cargo.lock` / `pixi.lock` / `package-lock.json` / `uv.lock`, whichever applies) along with dependency changes. It tracks exact dependency versions and must stay in sync with the manifest.

Common mistake: forgetting to `git add <lockfile>` after manifest changes — causes build failures for other developers and CI.

**Checklist before committing:**
- [ ] Manifest changes committed
- [ ] Lockfile changes committed (if dependencies changed)
- [ ] `git status` shows clean working tree

## No Stack-Specific Discipline Yet

Environment-management / toolchain conventions will be written here at the stack decisions (D3 engine toolchain / D5 compile-side; toolchain pins land at scaffold — doc-audit G2). Nothing is assumed before that.
