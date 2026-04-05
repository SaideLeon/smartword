#!/bin/bash

# Verifica se foi passada a mensagem
if [ -z "$1" ]; then
  echo "Digite a mensagem do commit:"
  read mensagem
else
  mensagem="$1"
fi

# Adiciona todos os arquivos
git add .

# Commit
git commit -m "$mensagem"

# Push
git push origin main

echo "Commit e push realizados com sucesso."