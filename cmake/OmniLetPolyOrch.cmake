# OmniLet <-> PolyOrch assembly adapter (predecessor form: VisiaEnginePolyOrch.cmake)
# D7: PolyOrch = the unified build orchestrator; submodule pinned 5945f2a.

set(POLYORCH_DIR "${CMAKE_CURRENT_SOURCE_DIR}/PolyOrch" CACHE INTERNAL "PolyOrch submodule root")

function(omnilet_ensure_polyorch)
  # first-wins sentinel (predecessor D39 form): if a superbuild already added
  # PolyOrch, reuse its copy; otherwise add our submodule copy once.
  if(TARGET polyorch_iface OR COMMAND polyorch_rust_setup)
    return()
  endif()
  if(NOT EXISTS "${POLYORCH_DIR}/CMakeLists.txt")
    message(FATAL_ERROR
      "PolyOrch submodule missing at ${POLYORCH_DIR}. Run: git submodule update --init")
  endif()
  add_subdirectory("${POLYORCH_DIR}" "${CMAKE_BINARY_DIR}/PolyOrch")
endfunction()

# ---- face wiring (D7 adjudication 2 executed; D11 routes rust through pixi) ----
# Signatures read from in-tree helpers before wiring (proposal Task 3 discipline):
#   polyorch_pixi_setup(INSTALL FROZEN LOCKED COPY_SCRIPTS MANIFEST ENVIRONMENT VERSION ...)
#   polyorch_rust_setup(REQUIRED NO_NATIVE_PROBE FROM <pixi|system>)   # PolyOrchFindRust.cmake:989
# Predecessor wrapper form: .refinfo/VisiaEngine/cmake/VisiaEnginePolyOrch.cmake L62-90
# (API floor 0.2.0 -> pixi_setup(COPY_SCRIPTS) -> rust_setup(FROM pixi)).

function(omnilet_ensure_polyorch_rust)
  get_target_property(_ver PolyOrch::PolyOrch INTERFACE_POLYORCH_VERSION)
  if(NOT _ver OR _ver VERSION_LESS "0.2.0")
    message(FATAL_ERROR "OmniLet needs PolyOrch >= 0.2.0 but the sentinel reports '${_ver}'")
  endif()
  if(NOT COMMAND polyorch_rust_setup)
    get_target_property(_po_mod PolyOrch::PolyOrch INTERFACE_POLYORCH_CMAKE_DIR)
    include("${_po_mod}/PolyOrchFindRust.cmake")
  endif()
  # D11: rust toolchain lives in the pixi env (pixi.toml single source; pixi.lock pinned).
  if(NOT COMMAND polyorch_pixi_setup)
    get_target_property(_po_mod PolyOrch::PolyOrch INTERFACE_POLYORCH_CMAKE_DIR)
    include("${_po_mod}/PolyOrchPixiHelpers.cmake")
  endif()
  polyorch_pixi_setup(COPY_SCRIPTS)
  polyorch_rust_setup(REQUIRED FROM pixi)
  message(STATUS "OmniLet: PolyOrch rust face ready (route = pixi, cargo = ${PolyOrch_RUST_CARGO_EXECUTABLE})")
endfunction()

# Node face: wired at the first JS-consuming slice need (compiler kernel); the
# helper module is PolyOrchNodeHelpers.cmake (same include pattern as above).
