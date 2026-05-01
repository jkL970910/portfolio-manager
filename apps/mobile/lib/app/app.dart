import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../core/auth/mobile_auth_session.dart";
import "../core/auth/mobile_auth_store.dart";
import "../core/theme/loo_theme.dart";
import "../features/auth/presentation/login_page.dart";
import "../features/shared/data/loo_minister_context_models.dart";
import "../features/shared/presentation/loo_minister_card.dart";
import "../features/shared/presentation/loo_minister_scope.dart";
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
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _ministerAnalysisAction = ValueNotifier<LooMinisterSuggestedAction?>(null);

  MobileAuthSession? _session;
  LooMinisterPageContext? _ministerContext;
  Future<String?>? _refreshInFlight;
  var _loading = true;

  @override
  void dispose() {
    _ministerAnalysisAction.dispose();
    super.dispose();
  }

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
      _ministerContext = null;
    });
  }

  Future<void> _clearSession() async {
    await _authStore.clear();
    if (!mounted) {
      return;
    }

    setState(() {
      _session = null;
      _ministerContext = null;
    });
  }

  void _setMinisterContext(LooMinisterPageContext pageContext) {
    if (!mounted) {
      return;
    }

    setState(() {
      _ministerContext = pageContext;
    });
  }

  void _requestMinisterAnalysisAction(LooMinisterSuggestedAction action) {
    _ministerAnalysisAction.value = null;
    _ministerAnalysisAction.value = action;
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
    final apiClient = session == null
        ? null
        : LooApiClient(
            accessToken: session.accessToken,
            refreshAccessToken: _refreshAccessToken,
            onUnauthorized: _clearSession,
          );

    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: "Loo国的财富宝库",
      debugShowCheckedModeBanner: false,
      theme: buildLooTheme(),
      builder: (context, child) {
        final currentChild = child ?? const SizedBox.shrink();
        if (_loading || session == null || apiClient == null) {
          return currentChild;
        }

        return LooMinisterScope(
          onContextChanged: _setMinisterContext,
          analysisActionListenable: _ministerAnalysisAction,
          child: Stack(
            children: [
              Positioned.fill(child: currentChild),
              LooMinisterFloatingButton(
                apiClient: apiClient,
                navigatorKey: _navigatorKey,
                pageContext: _ministerContext ?? _fallbackMinisterContext,
                suggestedQuestion: _suggestedMinisterQuestion,
                onSuggestedActionConfirmed: _requestMinisterAnalysisAction,
              ),
            ],
          ),
        );
      },
      home: _loading
          ? const _StartupScreen()
          : session == null
              ? LoginPage(onAuthenticated: _setSession)
              : MobileRootShell(
                  apiClient: apiClient!,
                  viewerName: session.viewerName,
                  baseCurrency: session.baseCurrency,
                  onDisplayCurrencyChanged: _setDisplayCurrency,
                  onLogout: _logout,
                ),
    );
  }

  LooMinisterPageContext get _fallbackMinisterContext {
    return LooMinisterPageContext(
      page: "overview",
      title: "Loo国",
      asOf: DateTime.now().toUtc().toIso8601String(),
      displayCurrency: _session?.baseCurrency ?? "CAD",
      facts: const [
        LooMinisterFact(
          id: "active-app",
          label: "当前应用",
          value: "Loo国财富宝库",
          source: "system",
        ),
      ],
      warnings: const ["当前页面还没有完整结构化上下文，大臣会先给出保守解释。"],
    );
  }

  String get _suggestedMinisterQuestion {
    return switch (_ministerContext?.page) {
      "overview" => "为什么总资产曲线和卡片数字可能不同？",
      "portfolio" => "当前组合最应该先检查什么？",
      "account-detail" => "这个账户的健康度应该怎么看？",
      "holding-detail" => "这个持仓最大的风险和作用是什么？",
      "security-detail" => "这个标的和我的组合适配吗？",
      "portfolio-health" => "健康分里最应该先修正什么？",
      "recommendations" => "这些推荐应该怎么优先看？",
      "import" => "手动导入时如何避免 CAD 和 USD 标的混淆？",
      "settings" => "我的投资偏好设置有什么需要注意？",
      _ => "这个页面我应该重点看什么？",
    };
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
