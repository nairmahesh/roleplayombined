# Pre-selected professional headshots — all IDs sourced from Unsplash demographic search pages.
# To swap a photo: replace the ID with any Unsplash photo ID (from the URL at unsplash.com/photos/{ID}).

BASE = "?w=400&h=400&fit=crop&crop=face&auto=format&q=80"
U    = "https://images.unsplash.com/photo-"

AVATAR_PHOTOS: dict[str, str] = {
    # East Asian male — sourced from unsplash.com/s/photos/asian-businessman
    "alex":   U + "1543132220-4bf3de6e10ae" + BASE,

    # White female — sourced from unsplash.com/s/photos/professional-white-woman-business
    "sarah":  U + "1760543998147-117ae5649c5c" + BASE,

    # White male — sourced from unsplash.com/s/photos/professional-white-man-business
    "james":  U + "1771898343647-bd979ad8cca5" + BASE,

    # Hispanic female — sourced from unsplash.com/s/photos/hispanic-professional
    "maria":  U + "1669782051654-f8805ea71993" + BASE,

    # White male (senior) — sourced from unsplash.com/s/photos/professional-white-man-business
    "robert": U + "1652471943570-f3590a4e52ed" + BASE,

    # White female — sourced from unsplash.com/s/photos/professional-white-woman-business
    "emma":   U + "1772987413078-e94f66e7047d" + BASE,

    # South Asian female — sourced from unsplash.com/s/photos/indian-professional-woman
    "priya":  U + "kbjvSC5RnC0" + BASE,

    # East Asian male — sourced from unsplash.com/s/photos/asian-businessman
    "jordan": U + "wMB_rSmGW-M" + BASE,

    # Black male — sourced from unsplash.com/s/photos/professional-black-man
    "marcus": U + "xE32sSCn_SU" + BASE,

    # Middle Eastern female — sourced from unsplash.com/s/photos/arab-business-woman
    "layla":  U + "ynfLZzL51CY" + BASE,

    # South Asian male — sourced from unsplash.com/s/photos/indian-man-professional
    "ravi":   U + "maibkgJiHI0" + BASE,

    # East Asian female — sourced from unsplash.com/s/photos/asian-professional-woman
    "yuki":   U + "y8RbKoTls_Y" + BASE,

    # Black female — sourced from unsplash.com/s/photos/professional-black-woman
    "aisha":  U + "2A2NWo9kQJg" + BASE,

    # Hispanic male — sourced from unsplash.com/s/photos/hispanic-professional
    "carlos": U + "bM4MXYPY61U" + BASE,
}


def get_all_avatar_photos() -> dict[str, str]:
    return AVATAR_PHOTOS
