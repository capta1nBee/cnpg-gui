#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

REPO="${1:-myregistry.local/poyraz}"
DATE_TAG=$(date +%Y%m%d%H%M%S)

FRONTEND_IMAGE="${REPO}/postgresqlgui-frontend:${DATE_TAG}"
BACKEND_IMAGE="${REPO}/postgresqlgui-backend:${DATE_TAG}"

echo -e "\033[0;36m=================================================\033[0m"
echo -e "\033[0;36m Poyraz-K8s PostgresGUI Deployment Script \033[0m"
echo -e "\033[0;36m=================================================\033[0m"
echo "Frontend Image : $FRONTEND_IMAGE"
echo "Backend Image  : $BACKEND_IMAGE"
echo -e "\033[0;36m=================================================\033[0m"

# Move to the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "\n\033[0;33m[1/4] Building and Pushing Backend Image with nerdctl...\033[0m"
cd backend
nerdctl build -t "$BACKEND_IMAGE" .
nerdctl push "$BACKEND_IMAGE"
cd ..

echo -e "\n\033[0;33m[2/4] Building and Pushing Frontend Image with nerdctl...\033[0m"
cd frontend
nerdctl build -t "$FRONTEND_IMAGE" .
nerdctl push "$FRONTEND_IMAGE"
cd ..

echo -e "\n\033[0;33m[3/4] Updating Kubernetes Manifests...\033[0m"
cd deploy

# Update image lines in YAML files (compatible with macOS/Linux sed)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|image: .*postgresqlgui-backend:.*|image: ${BACKEND_IMAGE}|g" backend.yaml
  sed -i '' "s|image: .*postgresqlgui-frontend:.*|image: ${FRONTEND_IMAGE}|g" frontend.yaml
else
  sed -i "s|image: .*postgresqlgui-backend:.*|image: ${BACKEND_IMAGE}|g" backend.yaml
  sed -i "s|image: .*postgresqlgui-frontend:.*|image: ${FRONTEND_IMAGE}|g" frontend.yaml
fi

echo -e "  -> Manifests updated with tag: $DATE_TAG"

echo -e "\n\033[0;33m[4/4] Applying to Kubernetes...\033[0m"
kubectl apply -f configmap.yaml
kubectl apply -f postgresql.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml

echo -e "\n\033[0;36m=================================================\033[0m"
echo -e "\033[0;32m Deployment completed successfully! \033[0m"
echo -e "\033[0;36m=================================================\033[0m"
