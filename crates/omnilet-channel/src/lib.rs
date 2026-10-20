//! omnilet-channel — the ordered two-way line between logic layer and view
//! layer (D15-2 + D15-3, user-ruled).
//!
//! Contract in one breath: patches go DOWN carrying a monotonic `seq`;
//! events go UP carrying the `view_seq` of the state that produced them.
//! Ordering is the whole trick (D15-3 anti-ghost rule): the host dispatches
//! an event to business JS only once that event's `view_seq` has been
//! applied downstream — a tap that "happened before" a visual change can
//! never be answered "after" it.
//!
//! Backpressure (D15-2) = latest-wins: buffered downlink patches coalesce
//! via [`omnilet_patch::Patch::merge`] at flush, so a 10x/second setData on
//! one path costs one wire op. Event frame-batching + touchmove coalescing
//! happen in the view-side runtime/engine (upstream of this line); this
//! crate guarantees the queue discipline, not the producer discipline.

use omnilet_patch::Patch;

pub type Seq = u64;

/// One downlink frame: the wire unit for both envelopes (JSON / binary).
#[derive(Debug, Clone, PartialEq)]
pub struct DownFrame {
    pub seq: Seq,
    pub patch: Patch,
}

/// Lifecycle kinds the host must dispatch (startup flow, architecture §③).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventKind {
    Tap,
    /// Coalescing duty lives upstream (first+latest point, middle dropped).
    TouchMove,
    Input,
}

/// One uplink event. `view_seq` = last patch applied when it happened.
#[derive(Debug, Clone, PartialEq)]
pub struct UpEvent {
    pub view_seq: Seq,
    pub kind: EventKind,
    pub target: String,
}

/// Send-side of the downlink (logic layer view of the line).
pub trait Downstream: Send {
    /// Buffer a patch; same-path collapse happens at flush (latest wins).
    fn push(&mut self, patch: Patch);
    /// Pump-time delivery: returns coalesced frames with assigned seqs.
    fn flush(&mut self) -> Vec<DownFrame>;
}

/// Send-side of the uplink (view layer's view of the line).
pub trait Upstream: Send {
    fn submit(&mut self, event: UpEvent);
    /// Frame-boundary drain, sorted by view_seq (oldest first) for stable
    /// dispatch — same-queue ordering, host-side enforcement point.
    fn drain(&mut self) -> Vec<UpEvent>;
}

/// Reference in-memory implementation (mock harness + envelope baseline).
#[derive(Default)]
pub struct Channel {
    next_seq: Seq,
    pending: Option<Patch>,
    up: Vec<UpEvent>,
}

impl Channel {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Downstream for Channel {
    fn push(&mut self, patch: Patch) {
        self.pending = Some(match self.pending.take() {
            Some(prev) => prev.merge(patch),
            None => patch,
        });
    }

    fn flush(&mut self) -> Vec<DownFrame> {
        match self.pending.take() {
            Some(patch) => {
                self.next_seq += 1;
                vec![DownFrame { seq: self.next_seq, patch }]
            }
            None => Vec::new(),
        }
    }
}

impl Upstream for Channel {
    fn submit(&mut self, event: UpEvent) {
        self.up.push(event);
    }

    fn drain(&mut self) -> Vec<UpEvent> {
        let mut out = std::mem::take(&mut self.up);
        out.sort_by_key(|e| e.view_seq);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use omnilet_patch::Op;
    use serde_json::json;

    fn set(path: &str, v: serde_json::Value) -> Patch {
        Patch::new(vec![Op::Set { path: path.into(), value: v }])
    }

    #[test]
    fn downlink_latest_wins_coalesces_at_flush() {
        let mut ch = Channel::new();
        // 10 quick writes to one path + a distinct second path:
        for i in 0..10 {
            ch.push(set("/x", json!(i)));
        }
        ch.push(set("/y", json!("keep")));
        let frames = ch.flush();
        assert_eq!(frames.len(), 1, "all buffered patches coalesce to one frame");
        assert_eq!(frames[0].patch.ops.len(), 2, "one op per path survives");
        assert_eq!(
            frames[0].patch.ops[0],
            Op::Set { path: "/x".into(), value: json!(9) },
            "latest wins"
        );
        assert!(ch.flush().is_empty(), "flush consumes the buffer");
    }

    #[test]
    fn seqs_are_monotonic_across_frames() {
        let mut ch = Channel::new();
        ch.push(set("/a", json!(1)));
        let f1 = ch.flush();
        ch.push(set("/a", json!(2)));
        let f2 = ch.flush();
        assert_eq!((f1[0].seq, f2[0].seq), (1, 2));
    }

    #[test]
    fn uplink_drain_sorted_by_view_seq() {
        let mut ch = Channel::new();
        // view layer may submit out of logical order across a busy frame:
        ch.submit(UpEvent { view_seq: 5, kind: EventKind::Tap, target: "btn".into() });
        ch.submit(UpEvent { view_seq: 3, kind: EventKind::Input, target: "field".into() });
        let evs = ch.drain();
        assert_eq!(
            (evs[0].view_seq, evs[1].view_seq),
            (3, 5),
            "dispatch order = state order (anti-ghost rule)"
        );
    }
}
