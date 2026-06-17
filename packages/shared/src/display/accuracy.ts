const accuracy = (n?: string | number | null) => (n === null || n === undefined ? '-' : `${((typeof n === 'number' ? n : parseFloat(n))* 100).toFixed(2)}%`);

export default accuracy;