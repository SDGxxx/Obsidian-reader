export function toUserFriendlyMessage(e: unknown): string {
	if (!(e instanceof Error)) return "操作失败：未知错误";

	const msg = e.message;

	if (msg === "请先在设置中配置密钥") return msg;
	if (msg === "请先选择至少一个章节") return msg;
	if (msg.includes("已选章节过长")) return msg;
	if (msg.includes("未获得有效结果")) return msg;
	if (msg.includes("返回格式无法解析")) return msg;

	const status = (e as { status?: number }).status;
	if (status === 401) return "操作失败：密钥无效或已过期";
	if (status === 403) return "操作失败：没有访问权限";
	if (status === 429) return "操作失败：请求过于频繁，请稍后重试";
	if (status && status >= 500) return "操作失败：AI 服务暂时不可用";

	if (
		msg.includes("fetch") ||
		msg.includes("network") ||
		msg.includes("ECONNREFUSED")
	) {
		return "操作失败：网络连接失败，请检查网络";
	}

	return "操作失败：请求出错，请稍后重试";
}
