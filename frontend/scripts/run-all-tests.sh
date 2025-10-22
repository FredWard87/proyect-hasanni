#!/bin/bash

echo "================================================"
echo "🧪 Ejecutando todas las pruebas"
echo "================================================"

# Backend tests
echo ""
echo "📦 Backend Tests..."
cd backend
npm test
BACKEND_EXIT=$?

# Frontend tests
echo ""
echo "⚛️  Frontend Tests..."
cd ../frontend
npm test
FRONTEND_EXIT=$?

# Combined report
echo ""
echo "📊 Generando reporte combinado..."
cd ..
node scripts/coverage-report.js
REPORT_EXIT=$?

echo ""
echo "================================================"
if [ $BACKEND_EXIT -eq 0 ] && [ $FRONTEND_EXIT -eq 0 ] && [ $REPORT_EXIT -eq 0 ]; then
  echo "✅ Todas las pruebas pasaron exitosamente"
else
  echo "❌ Algunas pruebas fallaron"
fi
echo "================================================"

exit $(($BACKEND_EXIT + $FRONTEND_EXIT + $REPORT_EXIT))