if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/home/ubuntu/.gradle/caches/9.0.0/transforms/164b65ad647ff6a32d934096dcee679b/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/libs/android.x86_64/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/home/ubuntu/.gradle/caches/9.0.0/transforms/164b65ad647ff6a32d934096dcee679b/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

