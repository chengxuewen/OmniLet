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

# Scaffold-time wiring (uncomment at scaffold, D7 adjudication 2):
# function(omnilet_ensure_polyorch_rust)
#   # translate any USE_PIXI option into polyorch_rust_setup(FROM pixi|system) — predecessor T-B1 form
#   polyorch_rust_setup(FROM system)
# endfunction()
