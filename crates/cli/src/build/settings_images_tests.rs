use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use landscape2_core::settings::{Images, LandscapeSettings, SettingsSource};

use super::{IMAGES_PATH, prepare_settings_images};

struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Self {
        static NEXT_ID: AtomicU64 = AtomicU64::new(0);
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "landscape-settings-images-{}-{nonce}-{id}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[tokio::test]
async fn local_brand_images_validate_and_are_copied_to_public_paths() {
    let root = TempDir::new();
    let output = root.0.join("dist");
    fs::create_dir_all(output.join(IMAGES_PATH)).unwrap();
    let favicon = root.0.join("favicon.svg");
    let open_graph = root.0.join("share.svg");
    let favicon_bytes = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"/>";
    let open_graph_bytes = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 630\"/>";
    fs::write(&favicon, favicon_bytes).unwrap();
    fs::write(&open_graph, open_graph_bytes).unwrap();

    let source = root.0.join("settings.yml");
    fs::write(
        &source,
        serde_json::to_vec(&LandscapeSettings {
            foundation: "Test".to_string(),
            url: "https://example.org".to_string(),
            images: Some(Images {
                favicon: Some(favicon.to_string_lossy().into_owned()),
                open_graph: Some(open_graph.to_string_lossy().into_owned()),
            }),
            ..Default::default()
        })
        .unwrap(),
    )
    .unwrap();
    let mut settings = LandscapeSettings::new(&SettingsSource {
        settings_file: Some(source),
        settings_url: None,
    })
    .await
    .unwrap();

    prepare_settings_images(&mut settings, &output).await.unwrap();

    let images = settings.images.unwrap();
    assert_eq!(images.favicon.as_deref(), Some("images/favicon.svg"));
    assert_eq!(images.open_graph.as_deref(), Some("images/share.svg"));
    assert_eq!(
        fs::read(output.join(images.favicon.unwrap())).unwrap(),
        favicon_bytes
    );
    assert_eq!(
        fs::read(output.join(images.open_graph.unwrap())).unwrap(),
        open_graph_bytes
    );
}

#[tokio::test]
async fn missing_local_brand_images_fail_preparation() {
    let root = TempDir::new();
    fs::create_dir(root.0.join(IMAGES_PATH)).unwrap();
    let missing = root.0.join("missing.png").to_string_lossy().into_owned();
    for images in [
        Images {
            favicon: Some(missing.clone()),
            ..Default::default()
        },
        Images {
            open_graph: Some(missing.clone()),
            ..Default::default()
        },
    ] {
        let mut settings = LandscapeSettings {
            images: Some(images),
            ..Default::default()
        };
        let error = prepare_settings_images(&mut settings, &root.0).await.unwrap_err();
        assert!(error.to_string().contains("failed to read image from path"));
        assert!(error.to_string().contains(&missing));
    }
}

#[tokio::test]
async fn remote_open_graph_url_is_preserved_without_fetching() {
    let root = TempDir::new();
    let url = "https://share.example.invalid/image.png";
    let mut settings = LandscapeSettings {
        images: Some(Images {
            open_graph: Some(url.to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    prepare_settings_images(&mut settings, &root.0).await.unwrap();

    assert_eq!(settings.images.unwrap().open_graph.as_deref(), Some(url));
    assert_eq!(fs::read_dir(&root.0).unwrap().count(), 0);
}
