import React, { useContext } from "react";
import { SITE_NAME, SITE_VERSION, ThemeContext } from "../config/config";
import { makeStyles } from "@material-ui/core";

console.log("BrandLogoNav: loaded new version");

const useStyles = makeStyles({
    siteNavLink: {
        textAlign: 'left',
        paddingTop: "6px",
        cursor: "default",
        userSelect: "none",
    }
});

function BrandLogoNav() {
    const context = useContext(ThemeContext);
    const classes = useStyles();
    const brandString = `${SITE_NAME} (v${SITE_VERSION})`;

    return (
        <div className={classes.siteNavLink}>
            {brandString}
        </div>
    );
}

export default BrandLogoNav;
