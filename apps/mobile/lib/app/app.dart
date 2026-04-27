import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../core/auth/mobile_auth_session.dart";
import "../core/auth/mobile_auth_store.dart";
import "../core/theme/loo_theme.dart";
import "../features/auth/presentation/login_page.dart";
import "router.dart";

class LooWealthApp extends StatefulWidget {
  const LooWealthApp({
    MobileAuthStore? authStore,
    super.key,
  }) : _authStore = authStore;

  final MobileAuthStore? _authStore;

  @override
  State<LooWealthApp> createState() => _LooWealthAppState();
}

class _LooWealthAppState extends State<LooWealthApp> {
  late final MobileAuthStore _authStore;

  MobileAuthSession? _session;
  Future<String?>? _refreshInFlight;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _authStore = widget._authStore ?? MobileAuthStore();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final storedSession = await _authStore.load();
    if (storedSession == null) {
      if (mounted) {
        setState(() => _loading = false);
      }
      return;
    }

    try {
      final response =
          await LooApiClient().refreshSession(storedSession.refreshToken);
      final refreshedSession = MobileAuthSession.fromApiResponse(response);
      await _authStore.save(refreshedSession);
      if (mounted) {
        setState(() {
          _session = refreshedSession;
          _loading = false;
        });
      }
    } catch (_) {
      await _authStore.clear();
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<String?> _refreshAccessToken() {
    final refreshInFlight = _refreshInFlight;
    if (refreshInFlight != null) {
      return refreshInFlight;
    }

    final refreshFuture = _refreshSessionForRequest();
    _refreshInFlight = refreshFuture;
    return refreshFuture.whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _refreshSessionForRequest() async {
    final session = _session;
    if (session == null || session.refreshToken.isEmpty) {
      await _clearSession();
      return null;
    }

    try {
      final response =
          await LooApiClient().refreshSession(session.refreshToken);
      final refreshedSession = MobileAuthSession.fromApiResponse(response);
      await _authStore.save(refreshedSession);
      if (mounted) {
        setState(() {
          _session = refreshedSession;
        });
      }
      return refreshedSession.accessToken;
    } catch (_) {
      await _clearSession();
      return null;
    }
  }

  Future<void> _setSession(MobileAuthSession session) async {
    await _authStore.save(session);
    if (!mounted) {
      return;
    }

    setState(() {
      _session = session;
    });
  }

  Future<void> _clearSession() async {
    await _authStore.clear();
    if (!mounted) {
      return;
    }

    setState(() {
      _session = null;
    });
  }

  Future<void> _logout() async {
    final session = _session;
    if (session != null) {
      try {
        await LooApiClient(accessToken: session.accessToken).logout();
      } catch (_) {}
    }

    await _clearSession();
  }

  Future<void> _setDisplayCurrency(String currency) async {
    final session = _session;
    if (session == null) {
      return;
    }

    await LooApiClient(
      accessToken: session.accessToken,
      refreshAccessToken: _refreshAccessToken,
      onUnauthorized: _clearSession,
    ).updateDisplayCurrency(currency);
    await _setSession(session.copyWith(baseCurrency: currency));
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;

    return MaterialApp(
      title: "Loo国的财富宝库",
      debugShowCheckedModeBanner: false,
      theme: buildLooTheme(),
      home: _loading
          ? const _StartupScreen()
          : session == null
              ? LoginPage(onAuthenticated: _setSession)
              : MobileRootShell(
                  apiClient: LooApiClient(
                    accessToken: session.accessToken,
                    refreshAccessToken: _refreshAccessToken,
                    onUnauthorized: _clearSession,
                  ),
                  viewerName: session.viewerName,
                  baseCurrency: session.baseCurrency,
                  onDisplayCurrencyChanged: _setDisplayCurrency,
                  onLogout: _logout,
                ),
    );
  }
}

class _StartupScreen extends StatelessWidget {
  const _StartupScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
