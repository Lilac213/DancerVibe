#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PhotoLibraryPlugin, "PhotoLibrary",
    CAP_PLUGIN_METHOD(pickVideo, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getVideoUrl, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getThumbnail, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkPermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermission, CAPPluginReturnPromise);
)
