package com.neuronose.entity.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.stream.Collectors;

@Converter(autoApply = false)
public class DoubleArrayConverter implements AttributeConverter<double[], String> {

    private static final String SEPARATOR = ",";

    @Override
    public String convertToDatabaseColumn(double[] attribute) {
        if (attribute == null || attribute.length == 0) {
            return null;
        }
        return Arrays.stream(attribute)
                .mapToObj(String::valueOf)
                .collect(Collectors.joining(SEPARATOR));
    }

    @Override
    public double[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return new double[0];
        }
        String[] parts = dbData.split(SEPARATOR);
        double[] result = new double[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Double.parseDouble(parts[i].trim());
        }
        return result;
    }
}
