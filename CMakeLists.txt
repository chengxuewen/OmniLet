# OmniLet — assembly layer
# cmr / project / PolyOrch assembly / SDK resolution / options / add_subdirectory / install hooks
# Build rules stay out of the root (except the ALIAS umbrella; install hooks via cmake/OmniLetInstall.cmake at scaffold).
cmake_minimum_required(VERSION 3.25)  # PolyOrch embed floor (predecessor D39 form; same floor)

project(OmniLet VERSION 0.1.0 LANGUAGES CXX)  # PolyOrch PlatformSupport needs CXX identity (predecessor same; measured: LANGUAGES NONE breaks its mkspec detect)

# ---- PolyOrch assembly -------------------------------------------------
# Unified build orchestrator for the polyglot monorepo (Rust crates + TS/JS
# packages). Physical form: git submodule pinned 5945f2a (gitee upstream,
# same commit as the predecessor archive; user-adjudicated 2026-10-16, D7).
include(cmake/OmniLetPolyOrch.cmake)
omnilet_ensure_polyorch()          # sentinel reuse/self-embed (first-wins, predecessor D39 form)
omnilet_ensure_polyorch_rust()     # D11: pixi-routed rust face (pixi.toml single source)

# ---- lanes --------------------------------------------------------------
# Rust lanes register through polyorch_rust_build (cargo owns them; no add_subdirectory).
# JS lanes build through the node face / pnpm (added when compiler packages land).

# T10 (cef-backend): container bin lane — cargo builds the artifact, cmake owns
# the graph edge + imported target (<name> mediates, <name>-build is the rule).
# TRIGGER GRANULARITY (measured 2026-10-20): the host-layer cargo rule depends
# on the MANIFEST only — cargo owns incremental, and src edits alone do not
# re-invoke it. CI gates therefore run clippy/test through cargo directly
# (test-matrix T1 rows); this lane is the artifact graph edge, not the checker.
polyorch_rust_build(
    TARGET  omnilet-container-exe   # PIT-13 guard: handle != artifact base
    PACKAGE omnilet-container
    CRATE   omnilet-container
    BINARY
    MANIFEST "${CMAKE_CURRENT_SOURCE_DIR}/crates/omnilet-container/Cargo.toml"
    # reuse the workspace cargo target dir (cef-sys caches its downloaded
    # dist in target/debug/build/... — a fresh .cargo-target would re-fetch)
    BASE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/target")
#
# ---- install hooks (later slice) ----
#   include(cmake/OmniLetInstall.cmake)
