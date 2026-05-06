import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../core/auth/mobile_auth_session.dart";
import "../core/auth/mobile_auth_store.dart";
import "../core/theme/loo_theme.dart";
import "../features/auth/presentation/login_page.dart";
import "../features/discover/presentation/discover_page.dart";
import "../features/portfolio/presentation/account_detail_page.dart";
import "../features/portfolio/presentation/health_score_page.dart";
import "../features/portfolio/presentation/holding_detail_page.dart";
import "../features/portfolio/presentation/security_detail_page.dart";
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
  final _rootShellController = MobileRootShellController();
  final _ministerAnalysisAction =
      ValueNotifier<LooMinisterSuggestedAction?>(null);

  MobileAuthSession? _session;
  LooMinisterPageContext? _ministerContext;
  List<LooMinisterRecentSubject> _recentMinisterSubjects = const [];
  Future<String?>? _refreshInFlight;
  var _loading = true;

  @override
  void dispose() {
    _ministerAnalysisAction.dispose();
    _rootShellController.dispose();
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
      _recentMinisterSubjects = const [];
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
      _recentMinisterSubjects = const [];
    });
  }

  void _setMinisterContext(LooMinisterPageContext pageContext) {
    if (!mounted) {
      return;
    }

    setState(() {
      _ministerContext = pageContext;
      _recentMinisterSubjects = _updatedRecentMinisterSubjects(pageContext);
    });
  }

  List<LooMinisterRecentSubject> _updatedRecentMinisterSubjects(
    LooMinisterPageContext pageContext,
  ) {
    final security = pageContext.subject.security;
    if (security == null || security.symbol.trim().isEmpty) {
      return _recentMinisterSubjects;
    }

    final recentSubject = LooMinisterRecentSubject(
      symbol: security.symbol.trim().toUpperCase(),
      securityId: security.securityId,
      exchange: security.exchange,
      currency: security.currency,
      name: security.name,
      source: pageContext.page,
    );
    final deduped = [
      ..._recentMinisterSubjects
          .where((subject) => subject.stableKey != recentSubject.stableKey),
      recentSubject,
    ];
    return deduped.length <= 5 ? deduped : deduped.sublist(deduped.length - 5);
  }

  void _requestMinisterAnalysisAction(LooMinisterSuggestedAction action) {
    _handleMinisterAction(action);
  }

  void _triggerMinisterAnalysisAction(LooMinisterSuggestedAction action) {
    _ministerAnalysisAction.value = null;
    _ministerAnalysisAction.value = action;
  }

  void _handleMinisterAction(LooMinisterSuggestedAction action) {
    switch (action.actionType) {
      case "run-analysis":
        _triggerMinisterAnalysisAction(action);
        _showMinisterActionMessage("已发送给当前页面的智能快扫。");
      case "navigate":
      case "open-form":
      case "update-preferences":
      case "refresh-data":
        _routeMinisterAction(action);
      default:
        _showMinisterActionMessage("大臣已给出建议，请按页面提示继续操作。");
    }
  }

  void _routeMinisterAction(LooMinisterSuggestedAction action) {
    final page = _targetString(action, "page");
    final scope = _targetString(action, "scope");
    final handled = _openMinisterTargetPage(
      page: page,
      scope: scope,
      action: action,
    );

    if (!handled) {
      _showMinisterActionMessage("这个建议需要在当前页面手动确认。");
      return;
    }

    if (action.actionType == "refresh-data") {
      _showMinisterActionMessage("已打开对应页面，请使用页面内刷新按钮确认执行。");
    } else if (action.actionType == "update-preferences" ||
        action.actionType == "open-form") {
      _showMinisterActionMessage("已打开对应页面，请在页面内检查并保存。");
    } else {
      _showMinisterActionMessage("已打开：${action.label}");
    }
  }

  bool _openMinisterTargetPage({
    required String? page,
    required String? scope,
    required LooMinisterSuggestedAction action,
  }) {
    final effectivePage = page ?? _pageForScope(scope);
    switch (effectivePage) {
      case "overview":
        _rootShellController.openTab(0);
        return true;
      case "portfolio":
        _rootShellController.openTab(1);
        return true;
      case "recommendations":
        _rootShellController.openTab(2);
        return true;
      case "discover":
      case "security-discover":
        return _pushMinisterPage(
          DiscoverPage(apiClient: _currentApiClient),
        );
      case "import":
        _rootShellController.openTab(3);
        return true;
      case "settings":
      case "preferences":
      case "investment-preferences":
        _rootShellController.openTab(4);
        return true;
      case "portfolio-health":
      case "health-score":
        return _pushMinisterPage(
          HealthScorePage(
            apiClient: _currentApiClient,
            accountId: _targetString(action, "accountId") ??
                _ministerContext?.subject.accountId,
            fallbackTitle: "健康巡查",
          ),
        );
      case "account-detail":
        final accountId = _targetString(action, "accountId") ??
            _ministerContext?.subject.accountId;
        if (accountId == null || accountId.isEmpty) {
          return false;
        }
        return _pushMinisterPage(
          AccountDetailPage(
            apiClient: _currentApiClient,
            accountId: accountId,
            fallbackTitle: "账户详情",
          ),
        );
      case "holding-detail":
        final holdingId = _targetString(action, "holdingId") ??
            _ministerContext?.subject.holdingId;
        if (holdingId == null || holdingId.isEmpty) {
          return false;
        }
        return _pushMinisterPage(
          HoldingDetailPage(
            apiClient: _currentApiClient,
            holdingId: holdingId,
            fallbackTitle: "持仓详情",
          ),
        );
      case "security-detail":
        final security =
            _targetSecurity(action) ?? _ministerContext?.subject.security;
        if (security == null || security.symbol.isEmpty) {
          return false;
        }
        return _pushMinisterPage(
          SecurityDetailPage(
            apiClient: _currentApiClient,
            symbol: security.symbol,
            fallbackTitle: security.name?.isNotEmpty == true
                ? security.name!
                : security.symbol,
            securityId: security.securityId,
            exchange: security.exchange,
            currency: security.currency,
          ),
        );
      default:
        return false;
    }
  }

  LooApiClient get _currentApiClient {
    final session = _session;
    return LooApiClient(
      accessToken: session?.accessToken ?? "",
      refreshAccessToken: _refreshAccessToken,
      onUnauthorized: _clearSession,
    );
  }

  bool _pushMinisterPage(Widget page) {
    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      return false;
    }
    navigator.push(MaterialPageRoute<void>(builder: (_) => page));
    return true;
  }

  String? _pageForScope(String? scope) {
    return switch (scope) {
      "portfolio" => "portfolio-health",
      "account" => "portfolio-health",
      "security" => "security-detail",
      "holding" => "holding-detail",
      _ => null,
    };
  }

  String? _targetString(LooMinisterSuggestedAction action, String key) {
    final value = action.target[key];
    return value is String && value.trim().isNotEmpty ? value.trim() : null;
  }

  LooMinisterSecurityIdentity? _targetSecurity(
    LooMinisterSuggestedAction action,
  ) {
    final targetSecurity = action.target["security"];
    if (targetSecurity is Map<String, dynamic>) {
      final symbol = targetSecurity["symbol"];
      if (symbol is String && symbol.trim().isNotEmpty) {
        return LooMinisterSecurityIdentity(
          symbol: symbol.trim().toUpperCase(),
          securityId: targetSecurity["securityId"] as String?,
          exchange: targetSecurity["exchange"] as String?,
          currency: targetSecurity["currency"] as String?,
          name: targetSecurity["name"] as String?,
          provider: targetSecurity["provider"] as String?,
          securityType: targetSecurity["securityType"] as String?,
        );
      }
    }

    final symbol = _targetString(action, "symbol");
    if (symbol == null) {
      return null;
    }
    return LooMinisterSecurityIdentity(
      symbol: symbol.toUpperCase(),
      securityId: _targetString(action, "securityId"),
      exchange: _targetString(action, "exchange"),
      currency: _targetString(action, "currency"),
      name: _targetString(action, "name"),
    );
  }

  void _showMinisterActionMessage(String message) {
    final context = _navigatorKey.currentContext;
    if (context == null) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
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
                recentSubjects: _recentMinisterSubjects,
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
                  controller: _rootShellController,
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
