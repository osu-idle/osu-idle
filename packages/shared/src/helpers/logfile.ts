export type LogWriter = (lines: string[]) => void | Promise<void>;

class Logfile {

	private static writer: LogWriter = lines => console.log(lines.join('\n'));

	private static running = false;
	private static _log: string[] = [];

	public static setWriter(writer: LogWriter) {
		this.writer = writer;
	}

	public static log(...args: Parameters<typeof console['log']>) {
		this._log.push(args.map(String).join(' '));
		this.run();
	}

	private static run() {
		if (this.running) return;
		this.running = true;

		setInterval(() => {
			if (!this._log.length) return;

			const pending = this._log.splice(0, this._log.length);
			Promise.resolve(this.writer(pending))
				.catch(() => this._log.unshift(...pending));
		}, 1000);
	}

}

export default Logfile;
