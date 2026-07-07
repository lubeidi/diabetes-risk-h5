#!/usr/bin/env bash
set -euo pipefail

# 用法: $0 <k8s环境> <helm服务> <环境> [镜像tag]
# 示例: $0 bj diabetes-risk dev
#       $0 hk diabetes-risk preview 2026-07-07-12-00

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "用法: $0 <k8s环境> <helm服务> <环境> [镜像tag]"
  echo ""
  echo "参数说明："
  echo "  k8s环境: 北京(bj/beijing) 或 香港(hk/hongkong)"
  echo "  helm服务: diabetes-risk"
  echo "  环境: dev, dev2, preview, stable"
  echo "  镜像tag: 可选。若提供，则只执行 helm 部署，不构建/推送镜像"
  echo ""
  echo "示例："
  echo "  $0 bj diabetes-risk dev"
  echo "  $0 bj diabetes-risk preview"
  echo "  $0 hk diabetes-risk dev"
  echo "  $0 bj diabetes-risk dev 2026-07-07-12-00"
  exit 1
fi

K8S_ENV="$1"
SERVICE="$2"
ENV="$3"
IMAGE_TAG="${4:-}"

ONLY_HELM=false
if [ -n "${IMAGE_TAG}" ]; then
  ONLY_HELM=true
fi

case "${K8S_ENV}" in
bj|beijing|北京)
  K8S_ENV="bj"
  K8S_ENV_FILE="/Users/4paradigm/deploy/hardware/ai_ch.env"
  ;;
hk|hongkong|香港)
  K8S_ENV="hk"
  K8S_ENV_FILE="/Users/4paradigm/deploy/hardware/ai_hk.env"
  ;;
*)
  echo "错误: 无效的k8s环境参数: ${K8S_ENV}"
  exit 1
  ;;
esac

case "${SERVICE}" in
diabetes-risk)
  ;;
*)
  echo "错误: 无效的服务参数: ${SERVICE}（仅支持 diabetes-risk）"
  exit 1
  ;;
esac

case "${ENV}" in
dev|dev2|preview|stable)
  ;;
*)
  echo "错误: 无效的环境参数: ${ENV}"
  exit 1
  ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HELM_CHART_DIR="${ROOT_DIR}/helm/${SERVICE}"

if [ "${K8S_ENV}" = "bj" ]; then
  VALUES_FILE="values-${ENV}.yaml"
else
  VALUES_FILE="values-hk-${ENV}.yaml"
fi
VALUES_PATH="${HELM_CHART_DIR}/${VALUES_FILE}"

if [ ! -f "${VALUES_PATH}" ]; then
  if [ "${K8S_ENV}" = "hk" ] && [ -f "${HELM_CHART_DIR}/values-${ENV}.yaml" ]; then
    echo "警告: ${VALUES_FILE} 不存在，使用 values-${ENV}.yaml"
    VALUES_PATH="${HELM_CHART_DIR}/values-${ENV}.yaml"
  else
    echo "错误: values 文件不存在: ${VALUES_PATH}"
    exit 1
  fi
fi

REGISTRY="bj-warehouse.tencentcloudcr.com/weike"
IMAGE_NAME="${SERVICE}"

if [ -z "${IMAGE_TAG}" ]; then
  IMAGE_TAG="$(date +%F-%H-%M)"
fi

echo ">>> Deploy ${SERVICE} env=${ENV} k8s=${K8S_ENV} tag=${IMAGE_TAG} onlyHelm=${ONLY_HELM}"

if [ "${ONLY_HELM}" = false ]; then
  echo ">>> docker build"
  docker build -t "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" "${ROOT_DIR}"
  echo ">>> docker push"
  docker push "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo ">>> update values image.tag"
if command -v gsed >/dev/null 2>&1; then
  SED=gsed
else
  SED=sed
fi

${SED} -i.bak -E "s#^(\\s*tag:\\s*).*\$#\\1\\\"${IMAGE_TAG}\\\"#g" "${VALUES_PATH}"
rm -f "${VALUES_PATH}.bak" || true

echo ">>> load k8s env: ${K8S_ENV_FILE}"
source "${K8S_ENV_FILE}"

LIB="${ROOT_DIR}/scripts/lib_helm_deploy.sh"
if [ ! -f "${LIB}" ]; then
  echo "错误: 缺少 ${LIB}，请从 chatbot_h5 同步"
  exit 1
fi

bash "${LIB}" "${SERVICE}" "${HELM_CHART_DIR}" "${VALUES_PATH}" "${ENV}" "${K8S_ENV}"

