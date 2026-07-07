#!/usr/bin/env bash
# helm_upgrade_install retries helm when ingress-nginx admission webhook is down.
set -euo pipefail

helm_upgrade_install() {
    local release_name="$1"
    local values_file="$2"
    local image_tag="$3"
    local chart_dir="$4"

    (
        cd "${chart_dir}"
        helm upgrade --install "${release_name}" . \
            -f "${values_file}" \
            --namespace api-adapter \
            --set image.tag="${image_tag}"
    )
    local code=$?
    if [ "${code}" -eq 0 ]; then
        return 0
    fi

    echo "===> helm 首次部署失败，检查 ingress-nginx admission webhook 状态..."
    if ! kubectl get validatingwebhookconfiguration ingress-nginx-admission >/dev/null 2>&1; then
        return "${code}"
    fi

    local endpoints
    endpoints="$(kubectl get endpoints -n ingress-nginx ingress-nginx-controller-admission -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)"
    if [ -n "${endpoints}" ]; then
        return "${code}"
    fi

    echo "===> ingress-nginx-controller-admission 无可用 endpoints，临时将 failurePolicy 设为 Ignore 后重试"
    kubectl patch validatingwebhookconfiguration ingress-nginx-admission \
        --type='json' \
        -p='[{"op": "replace", "path": "/webhooks/0/failurePolicy", "value": "Ignore"}]' || return "${code}"

    (
        cd "${chart_dir}"
        helm upgrade --install "${release_name}" . \
            -f "${values_file}" \
            --namespace api-adapter \
            --set image.tag="${image_tag}"
    )
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    SERVICE="${1:?service required}"
    HELM_CHART_DIR="${2:?chart dir required}"
    VALUES_PATH="${3:?values file required}"
    ENV="${4:?env required}"
    K8S_ENV="${5:?k8s env required}"
    IMAGE_TAG="${6:-}"

    if [ -z "${IMAGE_TAG}" ]; then
        IMAGE_TAG="$(grep -E '^\s*tag:' "${VALUES_PATH}" | head -1 | sed -E 's/.*tag:\s*"?([^"]+)"?.*/\1/')"
    fi

    RELEASE_NAME="${SERVICE}-${ENV}"
    echo ">>> helm upgrade --install ${RELEASE_NAME} namespace=api-adapter tag=${IMAGE_TAG} k8s=${K8S_ENV}"
    helm_upgrade_install "${RELEASE_NAME}" "${VALUES_PATH}" "${IMAGE_TAG}" "${HELM_CHART_DIR}"
    echo ">>> helm deploy done: ${RELEASE_NAME}"
fi
