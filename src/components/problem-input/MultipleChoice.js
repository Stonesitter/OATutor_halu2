import React from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import { renderText } from '../../platform-logic/renderText.js';
import { ThemeContext } from "../../config/config";

class MultipleChoice extends React.Component {
    static contextType = ThemeContext;

    constructor(props) {
        super(props);
        this.state = {
            value: props.choices.includes("General programmes") ? (props.defaultValue || []) : (props.defaultValue || null),
        };
    }

    handleChange = (event) => {
        console.log(event)
        if (!event || !event.target || typeof event.target.value === 'undefined') {
            console.error('Invalid event or event.target.value:', event);
            return;
        }
    
        const { choices } = this.props;
    
        if (choices.includes("General programmes")) {
            const value = event.target.value;
            this.setState((prevState) => {
                const selectedValues = new Set(prevState.value || []);
                if (selectedValues.has(value)) {
                    selectedValues.delete(value);
                } else {
                    selectedValues.add(value);
                }
                return { value: [...selectedValues] };
            }, () => this.props.onChange(this.state.value));
        } else {
            this.setState({ value: event.target.value });
            this.props.onChange(event);
        };
    };
    

    render() {
        const { choices: _choices = [], variabilization } = this.props;
        const { value } = this.state;

        const choices = [];
        if (Array.isArray(_choices)) {
            [...new Set(_choices)].forEach(choice => {
                if (choice.includes(" above")) {
                    choices.push(choice);
                } else {
                    choices.unshift(choice);
                }
            });
        }

        return (
            <div style={{ marginRight: "5%", textAlign: "center" }}>
                <FormControl>
                    {this.props.choices.includes("General programmes") ? (
                        choices.length > 0
                            ? choices.map((choice, i) => (
                                <FormControlLabel
                                    key={choice}
                                    control={
                                        <Checkbox
                                            checked={value.includes(choice)}
                                            onChange={this.handleChange}
                                            value={choice}
                                        />
                                    }
                                    label={renderText(choice, null, variabilization, this.context)}
                                />
                            ))
                            : "Error: This problem has no answer choices. Please submit feedback."
                    ) : (
                        <RadioGroup value={value} onChange={this.handleChange} >
                            {choices.length > 0
                                ? choices.map((choice, i) => (
                                    <FormControlLabel
                                        key={choice}
                                        value={choice}
                                        control={<Radio />}
                                        label={renderText(choice, null, variabilization, this.context)}
                                    />
                                ))
                                : "Error: This problem has no answer choices. Please submit feedback."}
                        </RadioGroup>
                    )}
                </FormControl>
            </div>
        );
    }
}

export default MultipleChoice;