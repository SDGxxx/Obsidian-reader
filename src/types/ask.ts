export interface AskResult {
	/** 用户原始输入文本（未经 trim） */
	original: string;
	/** 用户提出的问题 */
	question: string;
	/** AI 的回答 */
	answer: string;
}
