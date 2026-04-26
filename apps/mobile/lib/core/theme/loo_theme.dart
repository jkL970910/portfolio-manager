import "package:flutter/material.dart";

ThemeData buildLooTheme() {
  const seed = Color(0xFFB33A3A);
  const surface = Color(0xFFF7F0E4);
  const text = Color(0xFF2A1F1A);

  final scheme = ColorScheme.fromSeed(
    seedColor: seed,
    brightness: Brightness.light,
    surface: surface,
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: surface,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontWeight: FontWeight.w700, color: text),
      titleLarge: TextStyle(fontWeight: FontWeight.w700, color: text),
      bodyLarge: TextStyle(color: text, height: 1.4),
      bodyMedium: TextStyle(color: text, height: 1.4),
    ),
    useMaterial3: true,
  );
}
