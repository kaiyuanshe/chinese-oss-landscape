use anyhow::{Result, bail};
use std::process::Command;
use which::which;

fn main() -> Result<()> {
    // Tell Cargo to rerun this build script if the source changes
    println!("cargo:rerun-if-changed=../../ui/common/src");
    println!("cargo:rerun-if-changed=../../ui/common/tsup.config.ts");
    println!("cargo:rerun-if-changed=../../ui/embed/src");
    println!("cargo:rerun-if-changed=../../ui/embed/embed.html");
    println!("cargo:rerun-if-changed=../../ui/embed-item/public/embed-item.js");
    println!("cargo:rerun-if-changed=../../ui/embed-item/src");
    println!("cargo:rerun-if-changed=../../ui/embed-item/embed-item.html");
    println!("cargo:rerun-if-changed=../../ui/kiosk/kiosk.html");
    println!("cargo:rerun-if-changed=../../ui/webapp/src");
    println!("cargo:rerun-if-changed=../../ui/webapp/index.html");
    println!("cargo:rerun-if-changed=../../site/brand.json");
    println!("cargo:rerun-if-changed=../../scripts/site-brand.mjs");

    for package in ["common", "embed", "embed-item", "webapp"] {
        for file in ["package.json", "yarn.lock", "vite.config.ts", "tsconfig.json"] {
            println!("cargo:rerun-if-changed=../../ui/{package}/{file}");
        }
    }

    // Check if required external tools are available
    if which("cargo").is_err() {
        bail!("cargo not found in PATH (required)");
    }
    if which("yarn").is_err() {
        bail!("yarn not found in PATH (required to build the web application)");
    }

    // Build common
    run(
        "yarn",
        &["--cwd", "../../ui/common", "install", "--frozen-lockfile"],
    )?;
    run("yarn", &["--cwd", "../../ui/common", "build"])?;

    // Build embed
    run(
        "yarn",
        &["--cwd", "../../ui/embed", "install", "--frozen-lockfile"],
    )?;
    run("yarn", &["--cwd", "../../ui/embed", "build"])?;

    // Build embed item
    run(
        "yarn",
        &["--cwd", "../../ui/embed-item", "install", "--frozen-lockfile"],
    )?;
    run("yarn", &["--cwd", "../../ui/embed-item", "build"])?;

    // Build web application
    run(
        "yarn",
        &["--cwd", "../../ui/webapp", "install", "--frozen-lockfile"],
    )?;
    run("yarn", &["--cwd", "../../ui/webapp", "build"])?;

    Ok(())
}

/// Helper function to run a command.
fn run(program: &str, args: &[&str]) -> Result<()> {
    // Setup command
    let mut cmd = new_cmd(program);
    cmd.args(args);

    // Execute it and check output
    let output = cmd.output()?;
    if !output.status.success() {
        bail!(
            "\n\n> {cmd:?} (stderr)\n{}\n> {cmd:?} (stdout)\n{}\n",
            String::from_utf8(output.stderr)?,
            String::from_utf8(output.stdout)?
        );
    }

    Ok(())
}

/// Helper function to setup a command based on the target OS.
fn new_cmd(program: &str) -> Command {
    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", program]);
        cmd
    } else {
        Command::new(program)
    }
}
