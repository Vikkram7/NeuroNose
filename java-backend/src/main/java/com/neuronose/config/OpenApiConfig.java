package com.neuronose.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Value("${server.port:8080}")
    private String serverPort;

    @Bean
    public OpenAPI neuroNoseOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("NeuroNose API")
                        .description("REST API for NeuroNose Electronic Nose, IoT Device Management, Sensor Stream, and Gas Analytics.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("NeuroNose Engineering")
                                .email("contact@neuronose.internal"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .servers(List.of(
                        new Server().url("http://localhost:" + serverPort).description("Local Environment"),
                        new Server().url("/").description("Current Server Context")
                ));
    }
}
