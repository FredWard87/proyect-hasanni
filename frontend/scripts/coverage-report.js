#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const backendPath = path.join(__dirname, '../backend/coverage/coverage-summary.json');
const frontendPath = path.join(__dirname, '../frontend/coverage/coverage-summary.json');

function readCoverage(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error leyendo ${filePath}:`, error.message);
    return null;
  }
}

function calculateCoverage(coverage) {
  if (!coverage || !coverage.total) return null;
  
  const total = coverage.total;
  return {
    lines: total.lines.pct,
    statements: total.statements.pct,
    functions: total.functions.pct,
    branches: total.branches.pct
  };
}

function printCoverage(name, coverage) {
  console.log(`\n📊 ${name}:`);
  console.log(`  Lines:      ${coverage.lines.toFixed(2)}%`);
  console.log(`  Statements: ${coverage.statements.toFixed(2)}%`);
  console.log(`  Functions:  ${coverage.functions.toFixed(2)}%`);
  console.log(`  Branches:   ${coverage.branches.toFixed(2)}%`);
}

console.log('\n' + '='.repeat(50));
console.log('📊 REPORTE DE COBERTURA COMBINADO');
console.log('='.repeat(50));

const backendCov = readCoverage(backendPath);
const frontendCov = readCoverage(frontendPath);

if (!backendCov || !frontendCov) {
  console.log('\n❌ No se pudieron leer los archivos de cobertura.');
  console.log('Asegúrate de ejecutar los tests primero:');
  console.log('  cd backend && npm test');
  console.log('  cd frontend && npm test');
  process.exit(1);
}

const backend = calculateCoverage(backendCov);
const frontend = calculateCoverage(frontendCov);

if (!backend || !frontend) {
  console.log('\n❌ Error al calcular la cobertura.');
  process.exit(1);
}

printCoverage('BACKEND', backend);
printCoverage('FRONTEND', frontend);

const combined = {
  lines: (backend.lines + frontend.lines) / 2,
  statements: (backend.statements + frontend.statements) / 2,
  functions: (backend.functions + frontend.functions) / 2,
  branches: (backend.branches + frontend.branches) / 2
};

printCoverage('PROMEDIO TOTAL', combined);

const minCoverage = 76;
const allPass = Object.values(combined).every(v => v >= minCoverage);

console.log('\n' + '='.repeat(50));
if (allPass) {
  console.log('✅ ¡EXCELENTE! Cumple con el mínimo de 76% en todas las métricas');
} else {
  console.log(`❌ No cumple con el mínimo de ${minCoverage}% en alguna métrica`);
  console.log('\nMétricas que necesitan mejorar:');
  Object.entries(combined).forEach(([key, value]) => {
    if (value < minCoverage) {
      console.log(`  - ${key}: ${value.toFixed(2)}% (falta ${(minCoverage - value).toFixed(2)}%)`);
    }
  });
}
console.log('='.repeat(50) + '\n');

process.exit(allPass ? 0 : 1);