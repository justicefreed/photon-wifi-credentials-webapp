To use this tool, you need the following (or equivalent on your photon device's firmware)

```
// in a header
#if Wiring_WiFi
#define SOFTAP_PREFIX  "PHOTON"
System.set(SYSTEM_CONFIG_SOFTAP_PREFIX, SOFTAP_PREFIX);
void app_page_handler(const char* url, ResponseCallback* cb, void* cbArg, Reader* body, Writer* result, void* reserved);
inline void particle_startup() { softap_set_application_page_handler(app_page_handler, nullptr); }  // must get called by your STARTUP() macro somehow
#endif


// in a .cpp
#if Wiring_WiFi
void app_page_handler(const char* url, ResponseCallback* cb, void* cbArg, Reader* body, Writer* result, void* reserved) {
    if (strcmp(url, "/reset") == 0) {
        System.reset();
    }
    // other urls are handled by system handler
}
#endif
```

For this firmware to work properly, you may need to run your device in `SYSTEM_THREAD(ENABLED);` mode.  You may also need to manually trigger entering listening mode with `WiFi.listen()` as appropriate for your application.

To run the tool you need to load up the web page locally on your device first, and *then* connect to the device's hotspot.