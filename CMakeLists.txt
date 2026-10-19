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

# ---- SDK resolution / toolchains ---------------------------------------
# Scaffold-time wiring (D7 adjudication 2: infra now, wiring at scaffold):
#   omnilet_ensure_polyorch_rust()   # rust face: cargo workspace (crates/)
#   polyorch_node_setup()            # node face: pnpm workspace (compiler/runtime/packages/console)
#
# ---- add_subdirectory lanes (scaffold creates these; each is born into the graph) ----
#   add_subdirectory(crates)         # Rust: engine/container (D3)
#   add_subdirectory(compiler)       # TS: table-driven compiler (D5), if it carries CMake-visible targets
#
# ---- install hooks (scaffold) ----
#   include(cmake/OmniLetInstall.cmake)
