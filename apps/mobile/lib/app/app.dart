import "package:flutter/material.dart";

import "../core/theme/loo_theme.dart";
import "router.dart";

class LooWealthApp extends StatelessWidget {
  const LooWealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Loo国的财富宝库",
      debugShowCheckedModeBanner: false,
      theme: buildLooTheme(),
      home: const MobileRootShell(),
    );
  }
}
