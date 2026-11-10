package com.zhipao.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;

/**
 * 文件上传服务
 *
 *   POST /api/upload   上传图片（证件照 / 头像）
 *
 * ★ 未配置对象存储 → 返回占位 URL（不报错，让流程能跑通）
 *   配置后自动切换到真实上传
 *
 * ⚠️ AGENTS.md 要求图片必须走对象存储（TabBar 图标除外），
 *   禁止打包进项目。
 */
@Slf4j
@Service
public class StorageService {

    @Value("${zhipao.storage.endpoint:}")
    private String endpoint;

    @Value("${zhipao.storage.region:}")
    private String region;

    @Value("${zhipao.storage.bucket:}")
    private String bucket;

    @Value("${zhipao.storage.access-key:}")
    private String accessKey;

    @Value("${zhipao.storage.secret-key:}")
    private String secretKey;

    /** 允许的图片类型 */
    private static final String[] ALLOWED_MIME = {
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    };

    /** 单文件大小上限：5MB */
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    /**
     * 上传图片
     *
     * @param file   上传的文件
     * @param userId 用户 ID（用于路径隔离）
     * @param scene  场景（avatar / idcard），用于目录区分
     * @return { url, devMode }
     */
    public UploadResult upload(MultipartFile file, String userId, String scene) {
        if (file == null || file.isEmpty()) {
            throw BizException.badRequest("缺少文件");
        }

        // 校验类型与大小
        validate(file);

        String ext = resolveExt(file.getOriginalFilename(), file.getContentType());
        String objectKey = buildObjectKey(userId, scene, ext);

        // ---------- 未配置 → 开发模式 ----------
        if (!isConfigured()) {
            String fakeUrl = "https://dev-placeholder.local/" + objectKey;
            log.warn("【开发模式】对象存储未配置，返回占位 URL: {}", fakeUrl);
            return new UploadResult(fakeUrl, true);
        }

        // ---------- 真实上传 ----------
        try {
            String url = doUpload(file, objectKey);
            return new UploadResult(url, false);
        } catch (Exception e) {
            log.error("上传失败: {}", e.getMessage());
            throw BizException.badRequest("文件上传失败，请稍后重试");
        }
    }

    /**
     * 真实上传
     *
     * ⚠️ 需要按实际对象存储补全：
     *   - 腾讯云 COS：pnpm add cos-nodejs-sdk-v5 → Java 用 cos_api-bundle
     *   - 阿里云 OSS：aliyun-sdk-oss
     *   - MinIO：minio-java
     *
     * 当前框架已就绪，只需补 SD 调用。
     */
    private String doUpload(MultipartFile file, String objectKey) throws IOException {
        // TODO 按实际存储实现
        // 示例（腾讯云 COS）：
        //   COSCredentials cred = new BasicCOSCredentials(accessKey, secretKey);
        //   ClientConfig cfg = new ClientConfig(new Region(region));
        //   COSClient cos = new COSClient(cred, cfg);
        //   PutObjectRequest req = new PutObjectRequest(bucket, objectKey, file.getInputStream(), null);
        //   cos.putObject(req);
        //   return "https://" + bucket + ".cos." + region + ".myqcloud.com/" + objectKey;

        throw new UnsupportedOperationException(
                "对象存储 SDK 未接入，请按实际存储实现 doUpload()。"
                        + "配置留空时会上传返回占位 URL，不影响其他功能。");
    }

    // ========================================================================
    // 校验与工具
    // ========================================================================

    private void validate(MultipartFile file) {
        String mime = file.getContentType();
        if (mime == null) {
            throw BizException.badRequest("无法识别文件类型");
        }

        boolean allowed = false;
        for (String a : ALLOWED_MIME) {
            if (a.equalsIgnoreCase(mime)) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            throw BizException.badRequest("只支持 JPG / PNG / WebP 格式");
        }

        if (file.getSize() > MAX_SIZE) {
            throw BizException.badRequest("图片不能超过 5MB");
        }
    }

    private String resolveExt(String filename, String mime) {
        if (StrUtil.isNotBlank(filename) && filename.contains(".")) {
            String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
            if (ext.matches("[a-z0-9]{2,5}")) {
                return ext;
            }
        }
        // 从 MIME 推断
        if (mime != null) {
            return switch (mime.toLowerCase()) {
                case "image/png" -> "png";
                case "image/webp" -> "webp";
                default -> "jpg";
            };
        }
        return "jpg";
    }

    /** 生成对象键：scene/userId/date/uuid.ext */
    private String buildObjectKey(String userId, String scene, String ext) {
        String s = StrUtil.isBlank(scene) ? "misc" : scene.replaceAll("[^a-zA-Z0-9_-]", "");
        return s + "/" + userId + "/" + LocalDate.now() + "/"
                + IdUtil.fastSimpleUUID() + "." + ext;
    }

    /** 是否已配置 */
    public boolean isConfigured() {
        return StrUtil.isNotBlank(endpoint)
                && StrUtil.isNotBlank(bucket)
                && StrUtil.isNotBlank(accessKey)
                && StrUtil.isNotBlank(secretKey);
    }

    /** 上传结果 */
    public record UploadResult(String url, boolean devMode) {
    }
}
