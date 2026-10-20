//! omnilet-patch — the key-path change-notice contract (D15-1, user-ruled).
//!
//! The logical format is the SPEC: WeChat-family key-path semantics, with
//! RFC 6901 JSON Pointer paths — the standard answer to the escaping/array
//! questions WeChat's ad-hoc dot syntax never formalized. Physical envelope
//! today = JSON; the HMI binary envelope (D15-1 second envelope) plugs in
//! at the CHANNEL layer later without touching these types.
//!
//! Latest-wins merge lives HERE (it is patch semantics; omnilet-channel's
//! backpressure, D15-2, just calls `merge`).

use serde::{Deserialize, Serialize};

/// Path per RFC 6901 JSON Pointer: "" = whole doc; "/user/name"; "/list/3/done".
pub type Path = String;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Op {
    Set {
        path: Path,
        value: serde_json::Value,
    },
    Delete {
        path: Path,
    },
}

/// One change-notice exchanged between logic layer and view layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Patch {
    /// Patch FORMAT version. Negotiation follows D8-1 philosophy: a peer
    /// seeing a newer schemaVersion refuses the patch (fail-closed), never
    /// guesses. Same-version unknown fields are ignored (forward-compatible).
    pub schema_version: u32,
    pub ops: Vec<Op>,
}

pub const PATCH_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum PatchError {
    #[error("invalid JSON pointer path {0:?}: {1}")]
    BadPath(Path, &'static str),
    #[error("unsupported schemaVersion {0} (this peer speaks {PATCH_SCHEMA_VERSION})")]
    UnsupportedVersion(u32),
}

impl Patch {
    pub fn new(ops: Vec<Op>) -> Self {
        Self { schema_version: PATCH_SCHEMA_VERSION, ops }
    }

    /// Structural validation only: known version + legal RFC 6901 pointers
    /// (empty, or starting with '/'; no NULs). We do NOT invent a path
    /// grammar — the RFC is the spec (D15-1: "路径语法要设计+规范" answered
    /// by adopting the standard).
    pub fn validate(&self) -> Result<(), PatchError> {
        if self.schema_version != PATCH_SCHEMA_VERSION {
            return Err(PatchError::UnsupportedVersion(self.schema_version));
        }
        for op in &self.ops {
            let p = match op {
                Op::Set { path, .. } | Op::Delete { path } => path,
            };
            if !p.is_empty() && !p.starts_with('/') {
                return Err(PatchError::BadPath(p.clone(), "must be empty or start with '/'"));
            }
            if p.contains('\0') {
                return Err(PatchError::BadPath(p.clone(), "NUL not allowed"));
            }
        }
        Ok(())
    }

    /// Latest-wins coalescing (D15-2 backpressure semantics): fold `later`
    /// into `self` so at most one op per path survives, in last-seen order.
    /// set→delete collapses to delete; delete→set collapses to set.
    #[must_use]
    pub fn merge(self, later: Self) -> Self {
        use std::collections::HashMap;
        let mut order: Vec<Path> = Vec::new();
        let mut last: HashMap<Path, Op> = HashMap::new();
        for op in self.ops.into_iter().chain(later.ops) {
            let p = match &op {
                Op::Set { path, .. } | Op::Delete { path } => path.clone(),
            };
            if !last.contains_key(&p) {
                order.push(p.clone());
            }
            last.insert(p, op);
        }
        Self {
            schema_version: PATCH_SCHEMA_VERSION,
            ops: order.into_iter().filter_map(|p| last.remove(&p)).collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn round_trip_json_envelope() {
        let p = Patch::new(vec![
            Op::Set { path: "/user/name".into(), value: json!("张三") },
            Op::Set { path: "/list/3/done".into(), value: json!(true) },
            Op::Delete { path: "/stale".into() },
        ]);
        p.validate().expect("valid");
        let wire = serde_json::to_string(&p).unwrap();
        let back: Patch = serde_json::from_str(&wire).unwrap();
        assert_eq!(p, back, "JSON envelope is lossless (spec surface)");
    }

    #[test]
    fn bad_paths_and_versions_rejected_fail_closed() {
        let bad = Patch {
            schema_version: PATCH_SCHEMA_VERSION,
            ops: vec![Op::Delete { path: "user.name".into() }],
        };
        assert!(matches!(bad.validate(), Err(PatchError::BadPath(..))));
        let v = Patch { schema_version: 99, ops: vec![] };
        assert!(matches!(v.validate(), Err(PatchError::UnsupportedVersion(99))));
    }

    #[test]
    fn latest_wins_merge_collapses_per_path_in_order() {
        let a = Patch::new(vec![
            Op::Set { path: "/x".into(), value: json!(1) },
            Op::Set { path: "/y".into(), value: json!(1) },
        ]);
        let b = Patch::new(vec![
            Op::Set { path: "/x".into(), value: json!(2) }, // latest wins
            Op::Delete { path: "/y".into() },               // set→delete collapses to delete
            Op::Set { path: "/z".into(), value: json!(9) }, // fresh path appended
        ]);
        let m = a.merge(b);
        assert_eq!(
            m.ops,
            vec![
                Op::Set { path: "/x".into(), value: json!(2) },
                Op::Delete { path: "/y".into() },
                Op::Set { path: "/z".into(), value: json!(9) },
            ],
            "one op per path, first-touch order kept"
        );
    }
}
