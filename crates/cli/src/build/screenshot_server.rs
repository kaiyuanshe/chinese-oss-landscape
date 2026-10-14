//! Private HTTP transport for PNG/PDF export, not a website hosting command.

use std::path::PathBuf;

use anyhow::Result;
use axum::Router;
use tokio::net::TcpListener;
use tower_http::services::{ServeDir, ServeFile};

pub(super) async fn serve(directory: PathBuf, address: String) -> Result<()> {
    let index = directory.join("index.html");
    let router =
        Router::new().fallback_service(ServeDir::new(directory).not_found_service(ServeFile::new(index)));
    let listener = TcpListener::bind(address).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
