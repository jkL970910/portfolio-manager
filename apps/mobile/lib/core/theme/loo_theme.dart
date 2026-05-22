import "package:flutter/material.dart";

enum LooThemeMode {
  system,
  light,
  dark;

  ThemeMode get materialThemeMode {
    return switch (this) {
      LooThemeMode.system => ThemeMode.system,
      LooThemeMode.light => ThemeMode.light,
      LooThemeMode.dark => ThemeMode.dark,
    };
  }
}

extension LooThemeModeX on LooThemeMode {
  String get storageValue {
    return switch (this) {
      LooThemeMode.system => "system",
      LooThemeMode.light => "light",
      LooThemeMode.dark => "dark",
    };
  }

  String get label {
    return switch (this) {
      LooThemeMode.system => "跟随系统",
      LooThemeMode.light => "浅色",
      LooThemeMode.dark => "深色",
    };
  }

  static LooThemeMode fromStorageValue(String? value) {
    return switch (value) {
      "system" => LooThemeMode.system,
      "light" => LooThemeMode.light,
      "dark" => LooThemeMode.dark,
      _ => LooThemeMode.dark,
    };
  }
}

@immutable
class LooThemeTokens extends ThemeExtension<LooThemeTokens> {
  const LooThemeTokens({
    required this.pageGradient,
    required this.cardGradient,
    required this.heroGradient,
    required this.cardBorder,
    required this.mutedText,
    required this.subtleText,
    required this.accent,
    required this.accentSoft,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.radiusSm,
    required this.radiusMd,
    required this.radiusLg,
    required this.radiusXl,
    required this.gapXs,
    required this.gapSm,
    required this.gapMd,
    required this.gapLg,
    required this.gapXl,
  });

  final LinearGradient pageGradient;
  final LinearGradient cardGradient;
  final LinearGradient heroGradient;
  final Color cardBorder;
  final Color mutedText;
  final Color subtleText;
  final Color accent;
  final Color accentSoft;
  final Color success;
  final Color warning;
  final Color danger;
  final Color info;
  final double radiusSm;
  final double radiusMd;
  final double radiusLg;
  final double radiusXl;
  final double gapXs;
  final double gapSm;
  final double gapMd;
  final double gapLg;
  final double gapXl;

  @override
  LooThemeTokens copyWith({
    LinearGradient? pageGradient,
    LinearGradient? cardGradient,
    LinearGradient? heroGradient,
    Color? cardBorder,
    Color? mutedText,
    Color? subtleText,
    Color? accent,
    Color? accentSoft,
    Color? success,
    Color? warning,
    Color? danger,
    Color? info,
    double? radiusSm,
    double? radiusMd,
    double? radiusLg,
    double? radiusXl,
    double? gapXs,
    double? gapSm,
    double? gapMd,
    double? gapLg,
    double? gapXl,
  }) {
    return LooThemeTokens(
      pageGradient: pageGradient ?? this.pageGradient,
      cardGradient: cardGradient ?? this.cardGradient,
      heroGradient: heroGradient ?? this.heroGradient,
      cardBorder: cardBorder ?? this.cardBorder,
      mutedText: mutedText ?? this.mutedText,
      subtleText: subtleText ?? this.subtleText,
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      info: info ?? this.info,
      radiusSm: radiusSm ?? this.radiusSm,
      radiusMd: radiusMd ?? this.radiusMd,
      radiusLg: radiusLg ?? this.radiusLg,
      radiusXl: radiusXl ?? this.radiusXl,
      gapXs: gapXs ?? this.gapXs,
      gapSm: gapSm ?? this.gapSm,
      gapMd: gapMd ?? this.gapMd,
      gapLg: gapLg ?? this.gapLg,
      gapXl: gapXl ?? this.gapXl,
    );
  }

  @override
  LooThemeTokens lerp(ThemeExtension<LooThemeTokens>? other, double t) {
    if (other is! LooThemeTokens) {
      return this;
    }

    return LooThemeTokens(
      pageGradient: t < 0.5 ? pageGradient : other.pageGradient,
      cardGradient: t < 0.5 ? cardGradient : other.cardGradient,
      heroGradient: t < 0.5 ? heroGradient : other.heroGradient,
      cardBorder: Color.lerp(cardBorder, other.cardBorder, t) ?? cardBorder,
      mutedText: Color.lerp(mutedText, other.mutedText, t) ?? mutedText,
      subtleText: Color.lerp(subtleText, other.subtleText, t) ?? subtleText,
      accent: Color.lerp(accent, other.accent, t) ?? accent,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t) ?? accentSoft,
      success: Color.lerp(success, other.success, t) ?? success,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      danger: Color.lerp(danger, other.danger, t) ?? danger,
      info: Color.lerp(info, other.info, t) ?? info,
      radiusSm: _lerpDouble(radiusSm, other.radiusSm, t),
      radiusMd: _lerpDouble(radiusMd, other.radiusMd, t),
      radiusLg: _lerpDouble(radiusLg, other.radiusLg, t),
      radiusXl: _lerpDouble(radiusXl, other.radiusXl, t),
      gapXs: _lerpDouble(gapXs, other.gapXs, t),
      gapSm: _lerpDouble(gapSm, other.gapSm, t),
      gapMd: _lerpDouble(gapMd, other.gapMd, t),
      gapLg: _lerpDouble(gapLg, other.gapLg, t),
      gapXl: _lerpDouble(gapXl, other.gapXl, t),
    );
  }

  static double _lerpDouble(double a, double b, double t) => a + (b - a) * t;
}

extension LooThemeContext on BuildContext {
  LooThemeTokens get looTokens {
    return Theme.of(this).extension<LooThemeTokens>() ?? looDarkTokens;
  }
}

const looDarkTokens = LooThemeTokens(
  pageGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF27101A),
      Color(0xFF170A11),
      Color(0xFF0F080D),
    ],
  ),
  cardGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF3A1A27),
      Color(0xFF211018),
    ],
  ),
  heroGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF7A2E45),
      Color(0xFF3C1725),
      Color(0xFF1B0C13),
    ],
  ),
  cardBorder: Color(0x33FFD6E1),
  mutedText: Color(0xFFD9B9C4),
  subtleText: Color(0xFFA98491),
  accent: Color(0xFFFF7FA3),
  accentSoft: Color(0x33FF7FA3),
  success: Color(0xFF78D7A3),
  warning: Color(0xFFFFC66D),
  danger: Color(0xFFFF7C86),
  info: Color(0xFF82B7FF),
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 22,
  radiusXl: 30,
  gapXs: 4,
  gapSm: 8,
  gapMd: 14,
  gapLg: 20,
  gapXl: 28,
);

const looLightTokens = LooThemeTokens(
  pageGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFFF8E1),
      Color(0xFFFFF2EC),
      Color(0xFFFFE2E7),
    ],
  ),
  cardGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFFFBF0),
      Color(0xFFFFEDF1),
    ],
  ),
  heroGradient: LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFF8BBD0),
      Color(0xFFFFD7DC),
      Color(0xFFFFF8E1),
    ],
  ),
  cardBorder: Color(0x40FF6F61),
  mutedText: Color(0xFF7B4E52),
  subtleText: Color(0xFFA9787D),
  accent: Color(0xFFFF6F61),
  accentSoft: Color(0x2EFF6F61),
  success: Color(0xFF218B58),
  warning: Color(0xFFB87300),
  danger: Color(0xFFD94352),
  info: Color(0xFF3A6FB7),
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 22,
  radiusXl: 30,
  gapXs: 4,
  gapSm: 8,
  gapMd: 14,
  gapLg: 20,
  gapXl: 28,
);

ThemeData buildLooTheme() => buildLooLightTheme();

ThemeData buildLooLightTheme() {
  return _buildLooTheme(
    brightness: Brightness.light,
    tokens: looLightTokens,
    background: const Color(0xFFFFF8E1),
    surface: const Color(0xFFFFFBF0),
    primary: const Color(0xFFFF6F61),
    onSurface: const Color(0xFF3A2023),
  );
}

ThemeData buildLooDarkTheme() {
  return _buildLooTheme(
    brightness: Brightness.dark,
    tokens: looDarkTokens,
    background: const Color(0xFF170A11),
    surface: const Color(0xFF241018),
    primary: const Color(0xFFFF7FA3),
    onSurface: const Color(0xFFFFEFF3),
  );
}

ThemeData _buildLooTheme({
  required Brightness brightness,
  required LooThemeTokens tokens,
  required Color background,
  required Color surface,
  required Color primary,
  required Color onSurface,
}) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: primary,
    brightness: brightness,
    surface: surface,
    primary: primary,
  );

  final textTheme = ThemeData(
    brightness: brightness,
    useMaterial3: true,
  ).textTheme.apply(
        bodyColor: onSurface,
        displayColor: onSurface,
      );

  return ThemeData(
    brightness: brightness,
    colorScheme: scheme.copyWith(
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest:
          isDark ? const Color(0xFF321722) : const Color(0xFFFFEDF1),
      outline: tokens.cardBorder,
      error: tokens.danger,
    ),
    scaffoldBackgroundColor: background,
    textTheme: textTheme.copyWith(
      headlineLarge: textTheme.headlineLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.8,
      ),
      headlineMedium: textTheme.headlineMedium?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      titleLarge: textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
      ),
      titleMedium: textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: textTheme.bodyLarge?.copyWith(height: 1.45),
      bodyMedium: textTheme.bodyMedium?.copyWith(height: 1.45),
      labelLarge: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: surface,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(tokens.radiusLg),
        side: BorderSide(color: tokens.cardBorder),
      ),
    ),
    dialogTheme: DialogThemeData(
      elevation: 0,
      backgroundColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(tokens.radiusXl),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      elevation: 0,
      backgroundColor: Colors.transparent,
      modalBackgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: tokens.accentSoft,
      selectedColor: tokens.accentSoft,
      labelStyle: TextStyle(color: onSurface, fontWeight: FontWeight.w600),
      side: BorderSide(color: tokens.cardBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(tokens.radiusSm),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: isDark ? const Color(0xFF1A0810) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: onSurface,
        side: BorderSide(color: tokens.cardBorder),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor:
          isDark ? const Color(0xF21B0C13) : const Color(0xF9FFF7F8),
      indicatorColor: tokens.accentSoft,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? primary
              : tokens.mutedText,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w600,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? primary
              : tokens.mutedText,
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor:
          isDark ? const Color(0xFF402030) : const Color(0xFFFFFFFF),
      contentTextStyle:
          TextStyle(color: onSurface, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(tokens.radiusMd),
      ),
    ),
    extensions: [tokens],
    useMaterial3: true,
  );
}
