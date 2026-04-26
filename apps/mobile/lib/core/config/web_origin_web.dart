import "package:web/web.dart" as web;

String? currentWebOrigin() {
  return web.window.location.origin;
}
