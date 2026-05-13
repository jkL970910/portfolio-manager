import "package:web/web.dart" as web;

Future<void> openExternalLink(String url) async {
  web.window.open(url, "_blank");
}
