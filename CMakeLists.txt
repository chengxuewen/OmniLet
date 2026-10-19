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
#
# ---- install hooks (later slice) ----
#   include(cmake/OmniLetInstall.cmake)
