#!/bin/bash

# Mensagem do commit
if [ -z "$1" ]; then
  echo "Digite a mensagem do commit:"
  read mensagem
else
  mensagem="$1"
fi

# Flags
usar_force=false
usar_pull=false

# Verifica argumentos extras
for arg in "$@"; do
  if [ "$arg" = "force" ]; then
    usar_force=true
  fi
  if [ "$arg" = "pull" ]; then
    usar_pull=true
  fi
done

# Pull opcional (com rebase para evitar merge feio)
if [ "$usar_pull" = true ]; then
  echo "🔄 Atualizando repositório..."
  git pull --rebase origin main
fi

# Add
git add .

# Commit
git commit -m "$mensagem"

# Push
if [ "$usar_force" = true ]; then
  git push origin main --force
else
  git push origin main
fi

echo "✅ Commit e push realizados com sucesso."