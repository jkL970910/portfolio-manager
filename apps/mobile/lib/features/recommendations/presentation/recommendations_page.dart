import "package:flutter/material.dart";

class RecommendationsPage extends StatelessWidget {
  const RecommendationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("推荐"),
          SizedBox(height: 12),
          Text("这里将承接推荐摘要、账户适配、候选标的解释和情景比较。"),
        ],
      ),
    );
  }
}
