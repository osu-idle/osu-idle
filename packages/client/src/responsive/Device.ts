import Listener from '@osu-idle/shared/helpers/listener';

export default class Device {

	public static readonly resize = new Listener();

	private static initialized = false;
	public static init() {
		if (this.initialized) return;
		this.initialized = true;

		window.addEventListener('resize', () => this.resize.trigger());
	}

}

Device.init();