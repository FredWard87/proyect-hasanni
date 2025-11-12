// test-percentage.js
const { exec } = require('child_process');

exec('npm test -- --json --silent', (error, stdout, stderr) => {
  try {
    const result = JSON.parse(stdout);
    const total = result.numTotalTests || 0;
    const passed = result.numPassedTests || 0;
    const failed = result.numFailedTests || 0;
    const percentage = total > 0 ? (passed / total) * 100 : 0;

    console.log('🎯 RESUMEN DE TESTS');
    console.log('==================');
    console.log(`✅ Tests pasados: ${passed}`);
    console.log(`❌ Tests fallados: ${failed}`);
    console.log(`📋 Total de tests: ${total}`);
    console.log(`📊 Porcentaje de aprobación: ${percentage.toFixed(2)}%`);
    
    // Emoji según el porcentaje
    if (percentage === 100) {
      console.log('🎉 ¡EXCELENTE! 100% de aprobación');
    } else if (percentage >= 90) {
      console.log('👍 Muy buen trabajo');
    } else if (percentage >= 80) {
      console.log('💪 Casi allí, sigue así');
    } else if (percentage >= 70) {
      console.log('📈 Buen progreso');
    } else {
      console.log('🔧 Necesita mejorar');
    }
  } catch (err) {
    console.log('No se pudo calcular el porcentaje');
  }
});