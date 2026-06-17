const randomFrom = <T>(...array: T[]): T => array[Math.max(1, Math.floor(Math.random() * array.length)) - 1];

export default randomFrom;