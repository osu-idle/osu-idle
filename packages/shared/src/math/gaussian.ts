const gaussian = (sigma: number, centerFactor = 1) => {
	return ((Math.random() + Math.random() + Math.random() - 1.5) / (1.5 * centerFactor)) * sigma;
};

export default gaussian;
