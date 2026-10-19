//! omnilet-render — the frozen Renderer contract surface (S-2, D9; skeleton freeze per
//! scaffold-monorepo adjudication 1: layered traits + 3 core ops + extension slots).
//!
//! Layering (Hippy Driver/DOM/Renderer + glass-easel multi-backend precedent):
//!   element/layout layer (shared, future crate)  ──▶ render commands ──▶ THIS trait ──▶ backends
//!   (wry standard mode / wgpu HMI mode = two implementations of one trait, invariant ③)
//!
//! Frozen ops (ABI-level: these three never change; everything else enters via extension
//! slots marked `#[doc(hidden)] ext-slot`):
//!   1. attach — bind to a host-provided native window surface
//!   2. submit — consume one frame's render-command stream (DisplayList carrier, D3)
//!   3. report_damage — declare which regions changed (Dirty-Rect repaint input)
//!
//! Zero backend dependencies in this crate — construction fact, test-enforced.

use std::any::Any;

/// Opaque host window surface handle (platform-specific payload; backends downcast).
pub struct SurfaceHandle(pub Box<dyn Any>);

/// One frame's render-command stream (DisplayList bytes per D3; schema lands with the
/// compiler slice that first emits it — this trait carries it opaque on purpose).
pub struct RenderCommands<'a> {
    pub payload: &'a [u8],
}

/// Damage report for Dirty-Rect repaint (D3 HMI mode); rect format owned by the
/// element/layout layer (future crate) — opaque here.
pub struct DamageReport {
    pub full_redraw: bool,
}

/// The one Renderer trait (S-2). Object-safe; backend-agnostic; zero wgpu/wry/skia types.
pub trait Renderer: Send {
    /// 1. Bind to the host window surface. Lifecycle: exactly once before submit.
    fn attach(&mut self, surface: SurfaceHandle) -> Result<(), RenderError>;

    /// 2. Consume one frame's command stream. Implementations schedule GPU/CPU work;
    ///    presentation pacing belongs to the backend (invariant ④: host pumps, we never
    ///    own the loop).
    fn submit(&mut self, commands: RenderCommands<'_>) -> Result<(), RenderError>;

    /// 3. Report changed regions since last frame (Dirty-Rect input for HMI mode;
    ///    full_redraw = true is always a legal answer).
    fn report_damage(&mut self, damage: DamageReport);
}

#[derive(Debug)]
pub enum RenderError {
    /// Surface rejected (wrong platform payload, already attached, or invalid).
    AttachFailed(&'static str),
    /// Command stream malformed for this backend (version/schema mismatch).
    CommandsRejected(&'static str),
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Object-safety + minimal-impl proof: a stub backend constructs as Box<dyn Renderer>
    /// and round-trips the three frozen ops (the S-2 acceptance test).
    struct StubRenderer {
        attached: bool,
    }
    impl Renderer for StubRenderer {
        fn attach(&mut self, _surface: SurfaceHandle) -> Result<(), RenderError> {
            self.attached = true;
            Ok(())
        }
        fn submit(&mut self, _commands: RenderCommands<'_>) -> Result<(), RenderError> {
            if !self.attached {
                return Err(RenderError::AttachFailed("attach before submit"));
            }
            Ok(())
        }
        fn report_damage(&mut self, _damage: DamageReport) {}
    }

    #[test]
    fn trait_is_object_safe_and_ops_roundtrip() {
        let mut r: Box<dyn Renderer> = Box::new(StubRenderer { attached: false });
        // submit before attach must error (lifecycle enforced by contract test)
        assert!(matches!(
            r.submit(RenderCommands { payload: &[] }),
            Err(RenderError::AttachFailed(_))
        ));
        r.attach(SurfaceHandle(Box::new(()))).expect("attach ok");
        r.submit(RenderCommands { payload: &[1, 2, 3] })
            .expect("submit ok after attach");
        r.report_damage(DamageReport { full_redraw: false });
    }
}
