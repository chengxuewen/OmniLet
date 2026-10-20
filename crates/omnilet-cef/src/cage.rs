// T8: the D13-2 cage — one decision point, one audit shape.
// Navigation (on_before_browse), popups (on_before_popup), and resource
// requests (on_before_resource_load, pre-manager) all consult `decide_*`
// here; blocks emit an [AUDIT] line (persistence/rotation is the console
// slice's job — open item registered).

use omnilet_webview::{FilterVerdict, NavigationPolicy, RequestFilter};
use std::sync::{OnceLock, RwLock};

/// Process-wide cage state (browser process; set via WebViewBackend setters).
#[derive(Default)]
pub(crate) struct Cage {
    pub filter: Option<RequestFilter>,
    pub policy: NavigationPolicy,
}

pub(crate) fn cage() -> &'static RwLock<Cage> {
    static C: OnceLock<RwLock<Cage>> = OnceLock::new();
    C.get_or_init(Default::default)
}

/// Pure decision core — unit-testable without CEF.
/// Returns (allow, reason-if-blocked).
pub fn decide_navigation(url: &str, c: &Cage) -> Result<(), &'static str> {
    if url.starts_with("omnilet://") || url.starts_with("about:") || url.starts_with("data:") {
        return Ok(()); // own lanes
    }
    if let Some(f) = &c.filter && f(url) == FilterVerdict::Block {
        return Err("request-filter");
    }
    if !c.policy.allow_external_navigation {
        return Err("external-navigation-closed");
    }
    Ok(())
}

pub fn decide_resource(url: &str, c: &Cage) -> Result<(), &'static str> {
    if url.starts_with("omnilet://") {
        return Ok(()); // serving lane owns it
    }
    if let Some(f) = &c.filter && f(url) == FilterVerdict::Block {
        return Err("request-filter");
    }
    Ok(())
}

pub fn decide_popup(c: &Cage) -> Result<(), &'static str> {
    if c.policy.allow_windows {
        Ok(())
    } else {
        Err("popup-deny")
    }
}

/// Single audit shape (D13-2: block => record; grep-auditable lines for now).
pub fn audit_blocked(kind: &str, url: &str, reason: &str) {
    println!("[AUDIT] blocked kind={kind} url={url} rule={reason}");
}

#[cfg(test)]
mod tests {
    use super::*;
    use omnilet_webview::FilterVerdict::*;

    fn cage_with(filter: bool, nav: bool, win: bool) -> Cage {
        Cage {
            filter: filter.then(|| -> RequestFilter {
                std::sync::Arc::new(|u: &str| {
                    if u.contains("evil.test") {
                        Block
                    } else {
                        Allow
                    }
                })
            }),
            policy: NavigationPolicy {
                allow_windows: win,
                allow_external_navigation: nav,
            },
        }
    }

    #[test]
    fn own_schemes_always_pass_navigation() {
        let c = cage_with(false, false, false);
        assert!(decide_navigation("omnilet://app/index.html", &c).is_ok());
        assert!(decide_navigation("about:blank", &c).is_ok());
    }

    #[test]
    fn external_navigation_closed_by_default() {
        let c = cage_with(false, false, false);
        assert_eq!(decide_navigation("https://som.test/x", &c), Err("external-navigation-closed"));
        let open = cage_with(false, true, false);
        assert!(decide_navigation("https://som.test/x", &open).is_ok());
    }

    #[test]
    fn filter_blocks_before_policy_allows() {
        let c = cage_with(true, true, true);
        assert_eq!(decide_navigation("https://evil.test/", &c), Err("request-filter"));
        assert_eq!(decide_resource("https://evil.test/a.js", &c), Err("request-filter"));
        assert!(decide_resource("https://ok.test/a.js", &c).is_ok());
    }

    #[test]
    fn popups_denied_unless_policy_opens() {
        assert_eq!(decide_popup(&cage_with(false, false, false)), Err("popup-deny"));
        assert!(decide_popup(&cage_with(false, false, true)).is_ok());
    }
}
