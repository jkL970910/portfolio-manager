import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../core/auth/mobile_auth_session.dart";
import "../core/auth/mobile_auth_store.dart";
import "../core/theme/loo_theme.dart";
import "../features/auth/presentation/login_page.dart";
import "router.dart";

class LooWealthApp extends StatefulWidget {
  const LooWealthApp({super.key});

  @override
  State<LooWealthApp> createState() => _LooWealthAppState();
}

class _LooWealthAppState extends State<LooWealthApp> {
  final _authStore = MobileAuthStore();

  MobileAuthSession? _session;
  var _loading = true;

  @override
  void initState() {
    super.initState();
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
      final response = await LooApiClient().refreshSession(storedSession.refreshToken);
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

  Future<void> _setSession(MobileAuthSession session) async {
    await _authStore.save(session);
    if (!mounted) {
      return;
    }

    setState(() {
      _session = session;
    });
  }

  Future<void> _logout() async {
    final session = _session;
    if (session != null) {
      try {
        await LooApiClient(accessToken: session.accessToken).logout();
      } catch (_) {}
    }

    await _authStore.clear();
    if (!mounted) {
      return;
    }

    setState(() {
      _session = null;
    });
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
                  apiClient: LooApiClient(accessToken: session.accessToken),
                  viewerName: session.viewerName,
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
